import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch
from datetime import datetime
import metricas
from metricas import STAGE_LABELS, REVIEW_START_LABEL


def labeled(identity, state, at):
    label = REVIEW_START_LABEL if state == 'Inicio revisión' else next(key for key,value in STAGE_LABELS.items() if value == state)
    return dict(id=identity, event='labeled', label=dict(name=label),
                actor=dict(login='agvor'), created_at=at)


class MetricTests(unittest.TestCase):
    def setUp(self):
        self.issue = dict(number=10, node_id='issue10', state='open',
                          html_url='https://github.com/agvor/mattermost/issues/10',
                          body='<!-- pswe07:key=TA-02 -->')
        self.now = metricas.timestamp('2026-10-21T12:00:00-06:00')

    def calculate(self, timeline):
        events = metricas.normalize_events(self.issue, timeline)
        return metricas.calculate(self.issue, events, self.now)

    def test_business_days_exclude_weekend_with_costa_rica_timezone(self):
        start = metricas.timestamp('2026-10-16T23:00:00Z') # Viernes 17:00 local.
        end = metricas.timestamp('2026-10-20T23:00:00Z')   # Martes 17:00 local.
        self.assertEqual(metricas.business_days(start, end), 2)

    def test_first_validation_success_and_exact_event_times(self):
        row = self.calculate([
            labeled(1, 'Lista para iniciar','2026-10-12T12:00:00-06:00'),
            labeled(2, 'Implementación','2026-10-12T13:00:00-06:00'),
            labeled(3, 'Revisión','2026-10-13T12:00:00-06:00'),
            labeled(4, 'Inicio revisión','2026-10-14T12:00:00-06:00'),
            labeled(5, 'Validación','2026-10-14T14:00:00-06:00'),
            labeled(6, 'Validación','2026-10-15T12:00:00-06:00'),
            labeled(7, 'Entregada','2026-10-16T12:00:00-06:00')])
        self.assertEqual(row['lead_days'],4)
        self.assertEqual(row['review_wait_days'],1)
        self.assertEqual(row['first_validation'],'aceptada')

    def test_rework_does_not_reset_first_acceptance_or_first_result(self):
        timeline = [
            labeled(1, 'Lista para iniciar','2026-10-12T12:00:00-06:00'),
            labeled(2, 'Validación','2026-10-13T12:00:00-06:00'),
            labeled(3, 'Implementación','2026-10-14T12:00:00-06:00'),
            labeled(4, 'Lista para iniciar','2026-10-14T13:00:00-06:00'),
            labeled(5, 'Validación','2026-10-15T12:00:00-06:00'),
            labeled(6, 'Entregada','2026-10-16T12:00:00-06:00')]
        row = self.calculate(timeline)
        self.assertEqual(row['lead_days'],4)
        self.assertEqual(row['first_validation'],'rechazada')
        summary = metricas.summarize([row])['TA']
        self.assertEqual(summary['first_accepted_pct'],0)
        self.assertEqual(summary['first_validation_n'],1)

    def test_missing_events_are_unknown_not_zero(self):
        row = self.calculate([labeled(1,'Inicio revisión','2026-10-12T12:00:00-06:00'),
                              labeled(2,'Entregada','2026-10-13T12:00:00-06:00')])
        self.assertIsNone(row['lead_days'])
        self.assertIsNone(row['review_wait_days'])
        self.assertEqual(row['first_validation'],'')
        self.assertTrue(row['warnings'])
        self.assertIsNone(metricas.summarize([row])['TA']['first_accepted_pct'])

    def test_duplicate_delivery_labels_do_not_change_first_delivery(self):
        event = labeled(3,'Entregada','2026-10-14T12:00:00-06:00')
        row = self.calculate([labeled(1,'Lista para iniciar','2026-10-12T12:00:00-06:00'),
                              labeled(2,'Validación','2026-10-13T12:00:00-06:00'),
                              event,event,labeled(4,'Entregada','2026-10-15T12:00:00-06:00')])
        self.assertEqual(row['lead_days'],2)
        self.assertEqual(row['first_validation'],'aceptada')

    def test_first_validation_in_progress_is_not_rejection(self):
        row = self.calculate([labeled(1,'Lista para iniciar','2026-10-12T12:00:00-06:00'),
                              labeled(2,'Validación','2026-10-13T12:00:00-06:00')])
        self.assertEqual(row['first_validation'],'')
        self.assertEqual(metricas.summarize([row])['TA']['first_validation_n'],0)
        self.assertIsNotNone(row['open_age_days'])

    def test_closed_issue_without_delivery_is_not_counted_as_delivered(self):
        self.issue['state'] = 'closed'
        row = self.calculate([labeled(1,'Lista para iniciar','2026-10-12T12:00:00-06:00')])
        self.assertIsNone(row['lead_days'])
        self.assertIn('cerrada sin etapa Entregada',row['warnings'])

    def test_report_excludes_trials_and_exports_reconstructable_data(self):
        real = dict(self.issue, labels=[dict(name='pswe07'), dict(name='tipo:tarea')])
        trial = dict(real, number=11, labels=real['labels']+[dict(name='pswe07:prueba')])
        api = Mock()
        timeline = [labeled(1,'Lista para iniciar','2026-10-12T12:00:00-06:00'),
                    labeled(2,'Validación','2026-10-13T12:00:00-06:00'),
                    labeled(3,'Entregada','2026-10-14T12:00:00-06:00')]
        api.pages.side_effect = [[real, trial], timeline]
        data, snapshots = metricas.report(api,'agvor/mattermost')
        self.assertEqual(len(snapshots),1)
        self.assertEqual(data['summary']['TA']['first_accepted_pct'],100)
        self.assertEqual(data['summary']['implementation_comparison']['TA']['tasks'],1)
        with TemporaryDirectory() as directory:
            output = Path(directory)
            metricas.save_report(data,output)
            self.assertEqual({p.name for p in output.iterdir()},
                             {'eventos.json','resumen.json','metricas.csv','reporte.md'})
            self.assertIn('TA-02',(output/'metricas.csv').read_text())
            self.assertIn('event-3',(output/'eventos.json').read_text())

    def test_legacy_labels_preserve_original_timestamps(self):
        requested = labeled(2,'Revisión','2026-10-13T12:00:00-06:00')
        requested['label']['name'] = 'flujo:esperando-revision'
        review = labeled(3,'Inicio revisión','2026-10-14T12:00:00-06:00')
        review['label']['name'] = 'flujo:en-revision'
        validation = labeled(4,'Validación','2026-10-15T12:00:00-06:00')
        validation['label']['name'] = 'flujo:en-validacion'
        row = self.calculate([labeled(1,'Lista para iniciar','2026-10-12T12:00:00-06:00'),
                              requested,review,validation,
                              labeled(5,'Entregada','2026-10-16T12:00:00-06:00')])
        self.assertEqual(row['lead_days'],4)
        self.assertEqual(row['review_wait_days'],1)
        self.assertEqual(row['first_validation'],'aceptada')

    def test_legacy_review_start_without_request_is_not_zero_wait(self):
        event = labeled(1,'Inicio revisión','2026-10-12T12:00:00-06:00')
        event['label']['name'] = 'flujo:en-revision'
        row = self.calculate([event])
        self.assertIsNone(row['review_wait_days'])
        self.assertIn('Falta solicitud',row['warnings'])

    def test_sync_uses_latest_label_even_when_stage_is_unchanged(self):
        old = labeled(1,'Revisión','2026-10-12T12:00:00-06:00')
        old['label']['name'] = 'flujo:esperando-revision'
        new = labeled(2,'Revisión','2026-10-13T12:00:00-06:00')
        events = metricas.normalize_events(self.issue,[old,new])
        self.assertEqual(metricas.latest_stage(events)['label'],'flujo:revision')


    def test_explicit_correction_preserves_raw_event_and_real_delivery(self):
        timeline = [labeled(1, 'Lista para iniciar', '2026-10-12T09:00:00-06:00'),
                    labeled(2, 'Validación', '2026-10-13T09:00:00-06:00'),
                    labeled(3, 'Entregada', '2026-10-13T09:01:00-06:00'),
                    dict(labeled(4, 'Entregada', '2026-10-13T09:03:00-06:00'), event='unlabeled'),
                    labeled(5, 'Implementación', '2026-10-14T09:00:00-06:00'),
                    labeled(6, 'Validación', '2026-10-20T09:00:00-06:00'),
                    labeled(7, 'Entregada', '2026-10-22T09:00:00-06:00')]
        events = metricas.normalize_events(self.issue, timeline, {'3': 'Entrega marcada por error; ver incidencia.'})
        row = metricas.calculate(self.issue, events, metricas.timestamp('2026-10-30T12:00:00-06:00'))
        self.assertEqual(row['delivered_at'], '2026-10-22T09:00:00-06:00')
        self.assertEqual(row['lead_days'], 8)
        self.assertEqual(row['first_validation'], 'rechazada')
        self.assertEqual(len(events), 7)
        self.assertIn('Evento 3 excluido', row['warnings'])
        self.assertEqual(events[2]['excluded_reason'], 'Entrega marcada por error; ver incidencia.')

    def test_normal_label_cleanup_does_not_cancel_a_transition(self):
        timeline = [labeled(1, 'Lista para iniciar', '2026-10-12T12:00:00-06:00'),
                    dict(labeled(2, 'Lista para iniciar', '2026-10-12T12:02:00-06:00'), event='unlabeled'),
                    labeled(3, 'Implementación', '2026-10-12T12:03:00-06:00'),
                    labeled(4, 'Entregada', '2026-10-14T12:00:00-06:00')]
        self.assertEqual(self.calculate(timeline)['lead_days'], 2)

    def test_early_review_marker_warns_and_delivery_stops_pending_wait(self):
        row = self.calculate([
            labeled(1, 'Lista para iniciar', '2026-10-12T09:00:00-06:00'),
            labeled(2, 'Inicio revisión', '2026-10-13T09:00:00-06:00'),
            labeled(3, 'Revisión', '2026-10-13T10:00:00-06:00'),
            labeled(4, 'Validación', '2026-10-14T10:00:00-06:00'),
            labeled(5, 'Entregada', '2026-10-15T10:00:00-06:00')])
        self.assertIsNone(row['review_wait_days'])
        self.assertIsNone(row['pending_review_days'])
        self.assertIsNone(row['open_age_days'])
        self.assertIn('precede a la solicitud', row['warnings'])

    def test_g01_history_with_rework_and_block_keeps_elapsed_time(self):
        issue = dict(self.issue, body='<!-- pswe07:key=G-01 -->')
        timeline = [labeled(1, 'Lista para iniciar', '2026-10-12T12:00:00-06:00'),
                    labeled(2, 'Implementación', '2026-10-12T13:00:00-06:00'),
                    labeled(3, 'Revisión', '2026-10-13T12:00:00-06:00'),
                    labeled(4, 'Inicio revisión', '2026-10-14T12:00:00-06:00'),
                    labeled(5, 'Validación', '2026-10-14T14:00:00-06:00'),
                    labeled(6, 'Implementación', '2026-10-15T12:00:00-06:00'),
                    dict(id=7, event='labeled', label=dict(name='bloqueada'),
                         actor=dict(login='agvor'), created_at='2026-10-15T13:00:00-06:00'),
                    dict(id=8, event='unlabeled', label=dict(name='bloqueada'),
                         actor=dict(login='agvor'), created_at='2026-10-16T08:00:00-06:00'),
                    labeled(9, 'Validación', '2026-10-16T10:00:00-06:00'),
                    labeled(10, 'Entregada', '2026-10-16T12:00:00-06:00')]
        events = metricas.normalize_events(issue, timeline)
        row = metricas.calculate(issue, events, self.now)
        self.assertEqual((row['task'], row['group']), ('G-01', 'G'))
        self.assertEqual(row['lead_days'], 4)
        self.assertEqual(row['review_wait_days'], 1)
        self.assertEqual(row['first_validation'], 'rechazada')
        self.assertEqual(metricas.summarize([row])['G']['first_accepted_pct'], 0)
        self.assertEqual([e['event'] for e in events if e['label'] == 'bloqueada'], ['labeled', 'unlabeled'])

    def test_exclusions_are_configurable_and_exported(self):
        issue = dict(self.issue, labels=[dict(name='pswe07'), dict(name='tipo:tarea')])
        api = Mock()
        api.pages.side_effect = [[issue], [labeled(1, 'Lista para iniciar', '2026-10-12T12:00:00-06:00')]]
        with patch.dict(metricas.os.environ, {'PSWE07_EXCLUDED_EVENTS': '{"1":"Prueba de corrección documentada"}'}):
            data, snapshots = metricas.report(api, 'agvor/mattermost')
        self.assertEqual(snapshots[0]['last'], None)
        with TemporaryDirectory() as directory:
            metricas.save_report(data, Path(directory))
            self.assertIn('Prueba de corrección documentada', (Path(directory)/'eventos.json').read_text())
        for invalid in ('[]', '{"1":""}', '{"x":"motivo"}'):
            with self.subTest(invalid=invalid), patch.dict(metricas.os.environ, {'PSWE07_EXCLUDED_EVENTS': invalid}):
                self.assertRaises(ValueError, metricas.event_exclusions)

    def test_sync_continues_after_missing_project_item_and_reports_failure(self):
        api, project_api = Mock(), Mock()
        field = dict(id='status', name='Status', options=[dict(id='implementation', name='Implementación')])
        project_api.gql.side_effect = [dict(repositoryOwner=dict(projectV2=dict(id='project'))),
                                       dict(node=dict(fields=dict(nodes=[field])))]
        snapshots = []
        for number in (10, 11):
            issue = dict(self.issue, number=number, node_id=f'issue{number}')
            timeline = [labeled(number, 'Implementación', '2026-10-12T12:00:00-06:00')]
            events = metricas.normalize_events(issue, timeline)
            snapshots.append(dict(issue=issue, events=events, last=metricas.latest_stage(events)))
        api.pages.side_effect = [[labeled(n, 'Implementación', '2026-10-12T12:00:00-06:00')] for n in (10,11)]
        api.call.return_value = dict(labels=[dict(name='flujo:implementacion')])
        items = {'issue11': dict(id='item11', fieldValues=dict(nodes=[]))}
        with patch.object(metricas, 'project_items', return_value=items):
            with self.assertRaisesRegex(ValueError, 'Sincronización incompleta.*Issue 10'):
                metricas.sync(api, project_api, 'agvor/mattermost', 'agvor', 1, snapshots)
        self.assertEqual(project_api.mutation.call_count, 1)
        self.assertEqual(project_api.mutation.call_args.args[2]['itemId'], 'item11')

    def test_sync_ignores_excluded_latest_event(self):
        api, project_api = Mock(), Mock()
        field = dict(id='status', name='Status', options=[dict(id='implementation', name='Implementación')])
        project_api.gql.side_effect = [dict(repositoryOwner=dict(projectV2=dict(id='project'))),
                                       dict(node=dict(fields=dict(nodes=[field])))]
        timeline = [labeled(1, 'Implementación', '2026-10-12T12:00:00-06:00'),
                    labeled(2, 'Entregada', '2026-10-13T12:00:00-06:00')]
        events = metricas.normalize_events(self.issue, timeline, {'2':'Entrega por error'})
        snapshot = dict(issue=self.issue, events=events, last=metricas.latest_stage(events))
        api.pages.return_value = timeline
        api.call.return_value = dict(labels=[dict(name='flujo:implementacion'), dict(name='flujo:entregada')])
        item = dict(id='item10', fieldValues=dict(nodes=[]))
        with patch.object(metricas, 'project_items', return_value={'issue10':item}):
            metricas.sync(api, project_api, 'agvor/mattermost', 'agvor', 1, [snapshot])
        self.assertEqual(project_api.mutation.call_args.args[2]['value'], dict(singleSelectOptionId='implementation'))
        self.assertEqual(api.call.call_args.args[1], 'DELETE')


if __name__ == '__main__':
    unittest.main()
