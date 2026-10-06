import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock
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


if __name__ == '__main__':
    unittest.main()
