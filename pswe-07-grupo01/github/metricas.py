#!/usr/bin/env python3
"""Reconstruye métricas desde eventos de etiquetas; opcionalmente sincroniza Projects."""
import argparse
import csv
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import re
import statistics
import shutil
import subprocess
import sys
from urllib.parse import quote
from zoneinfo import ZoneInfo

STAGE_LABELS = {
    'flujo:pendiente': 'Pendiente',
    'flujo:lista': 'Lista para iniciar',
    'flujo:implementacion': 'Implementación',
    'flujo:revision': 'Revisión',
    'flujo:validacion': 'Validación',
    'flujo:entregada': 'Entregada',
}
REVIEW_START_LABEL = 'revision:iniciada'
# Se reconocen sin generar timestamps nuevos ni reescribir eventos anteriores.
LEGACY_LABELS = {
    'flujo:esperando-revision': 'Revisión',
    'flujo:en-revision': 'Revisión',
    'flujo:esperando-validacion': 'Validación',
    'flujo:en-validacion': 'Validación',
}
EVENT_STATES = {**STAGE_LABELS, **LEGACY_LABELS}
# Retirar una etapa poco después de añadirla, sin otra etapa entretanto, corrige un error.
RETRACTION_WINDOW = timedelta(minutes=15)

FIELDS_QUERY = '''query($id:ID!){node(id:$id){... on ProjectV2{
 fields(first:100){nodes{... on ProjectV2Field{id name dataType}
 ... on ProjectV2SingleSelectField{id name dataType options{id name color description}}}
 pageInfo{hasNextPage}}}}}'''


class GitHub:
    def __init__(self, token=None):
        self.environment = None
        if token:
            self.environment = dict(os.environ, GH_TOKEN=token)
        if not shutil.which('gh'):
            raise RuntimeError('Falta GitHub CLI (gh). Instálelo y ejecute gh auth login.')

    def call(self, endpoint, method='GET', payload=None):
        args = ['gh', 'api', endpoint, '--method', method,
                '-H', 'Accept: application/vnd.github+json',
                '-H', 'X-GitHub-Api-Version: 2022-11-28']
        if payload is not None:
            args += ['--input', '-']
        result = subprocess.run(args, input=json.dumps(payload) if payload is not None else None,
                                text=True, capture_output=True, env=self.environment)
        if result.returncode:
            # El token solo lo gestiona gh; no se imprime su entorno ni cabeceras.
            raise RuntimeError(f'GitHub rechazó {method} {endpoint}: {result.stderr.strip()}')
        data = json.loads(result.stdout) if result.stdout.strip() else None
        if isinstance(data, dict) and data.get('errors'):
            raise RuntimeError('GraphQL: ' + json.dumps(data['errors'], ensure_ascii=False))
        return data

    def gql(self, query, **variables):
        return self.call('graphql', 'POST', dict(query=query, variables=variables))['data']

    def mutation(self, name, input_type, values, selection):
        query = f'mutation($input:{input_type}!){{{name}(input:$input){{{selection}}}}}'
        return self.gql(query, input=values)[name]

    def pages(self, endpoint):
        results, page = [], 1
        separator = '&' if '?' in endpoint else '?'
        while True:
            batch = self.call(f'{endpoint}{separator}per_page=100&page={page}')
            results.extend(batch)
            if len(batch) < 100:
                return results
            page += 1



def project_items(api, project_id):
    result, cursor = {}, None
    query = '''query($id:ID!,$cursor:String){node(id:$id){... on ProjectV2{
      items(first:100,after:$cursor){nodes{id fieldValues(first:100){nodes{
       ... on ProjectV2ItemFieldSingleSelectValue{name field{... on ProjectV2SingleSelectField{id}}}
       ... on ProjectV2ItemFieldNumberValue{field{... on ProjectV2Field{id}}}
       ... on ProjectV2ItemFieldDateValue{field{... on ProjectV2Field{id}}}
      }} content{... on Issue{id} ... on PullRequest{id} ... on DraftIssue{id}}} pageInfo{hasNextPage endCursor}}}}}'''
    while True:
        connection = api.gql(query, id=project_id, cursor=cursor)['node']['items']
        for item in connection['nodes']:
            key = (item.get('content') or {}).get('id') or ('item:' + item['id'])
            result[key] = item
        if not connection['pageInfo']['hasNextPage']:
            return result
        cursor = connection['pageInfo']['endCursor']


ZONE = ZoneInfo('America/Costa_Rica')


def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(ZONE)


def business_days(start, end):
    """Cada 24 horas acumuladas de lunes a viernes equivale a un día hábil."""
    if end < start:
        raise ValueError('Intervalo temporal invertido.')
    seconds = 0
    cursor = start.astimezone(ZONE)
    end = end.astimezone(ZONE)
    while cursor < end:
        midnight = cursor.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        boundary = min(midnight, end)
        if cursor.weekday() < 5:
            seconds += (boundary - cursor).total_seconds()
        cursor = boundary
    return seconds / 86400


def normalize_events(issue, timeline):
    records, seen = [], set()
    for event in timeline:
        label = (event.get('label') or {}).get('name')
        kind = event.get('event')
        if kind not in ('labeled', 'unlabeled', 'closed', 'reopened'):
            continue
        if kind in ('labeled', 'unlabeled') and label not in EVENT_STATES and label not in (REVIEW_START_LABEL, 'bloqueada'):
            continue
        if not event.get('created_at'):
            continue
        identity = str(event.get('id') or f'{kind}:{label}:{event["created_at"]}')
        if identity in seen:
            continue
        seen.add(identity)
        actor = (event.get('actor') or {}).get('login', '')
        records.append(dict(issue=issue['number'], event_id=identity, event=kind,
                            label=label or '', state=EVENT_STATES.get(label, ''), actor=actor,
                            review_started=(label in (REVIEW_START_LABEL, 'flujo:en-revision')),
                            at=timestamp(event['created_at']).isoformat(),
                            evidence=f'{issue["html_url"]}#event-{identity}'))
    return sorted(records, key=lambda e: (e['at'], int(e['event_id']) if e['event_id'].isdigit() else 0))


def retracted(events):
    """Identificadores de etapas añadidas por error y retiradas dentro de RETRACTION_WINDOW."""
    result = set()
    for index, event in enumerate(events):
        if event['event'] != 'labeled' or not event['state']:
            continue
        for later in events[index+1:]:
            if timestamp(later['at']) - timestamp(event['at']) > RETRACTION_WINDOW:
                break
            if later['event'] == 'labeled' and later['state']:
                break
            if later['event'] == 'unlabeled' and later['label'] == event['label']:
                result.add(event['event_id'])
                break
    return result


def effective(events):
    removed = retracted(events)
    return [e for e in events if e['event_id'] not in removed]


def transitions(events):
    result = []
    for event in events:
        if event['event'] == 'labeled' and event['state']:
            if not result or event['state'] != result[-1]['state']:
                result.append(event)
    return result


def latest_stage(events):
    return next((e for e in reversed(effective(events)) if e['event'] == 'labeled' and e['state']), None)


def calculate(issue, events, now):
    corrections = len(events) - len(effective(events))
    events = effective(events)
    changes = transitions(events)
    marker = re.search(r'<!-- pswe07:key=((?:G|TA|DT)-\d\d) -->', issue.get('body') or '')
    key = marker[1] if marker else ''
    group = key.split('-')[0] if key else ''
    warnings = []
    if corrections:
        warnings.append(f'{corrections} etapa(s) retirada(s) como corrección; no se consideran.')
    def first(state):
        return next((e for e in changes if e['state'] == state), None)
    accepted, delivered = first('Lista para iniciar'), first('Entregada')
    requested = next((e for e in events if e['event'] == 'labeled' and
                      e['label'] in ('flujo:revision', 'flujo:esperando-revision')), None)
    review = next((e for e in events[events.index(requested)+1:] if e['event'] == 'labeled' and
                   e.get('review_started')), None) if requested else None
    # En el flujo nuevo Validación incluye espera y ejecución. En el historial
    # anterior se conserva el evento de inicio efectivo de la primera validación.
    validation = next((e for e in events if e['event'] == 'labeled' and
                       e['label'] in ('flujo:validacion','flujo:en-validacion')), None)
    validation_result = ''
    if validation:
        following = [e for e in events[events.index(validation)+1:]
                     if e['event'] == 'labeled' and e['state'] and e['state'] != 'Validación']
        if following:
            if following[0]['state'] == 'Entregada':
                validation_result = 'aceptada'
            elif following[0]['state'] == 'Implementación':
                validation_result = 'rechazada'
            else:
                warnings.append('Salida de primera validación ambigua; comprobar historial.')
    lead, wait = None, None
    if accepted and delivered:
        if delivered['at'] >= accepted['at']:
            lead = business_days(timestamp(accepted['at']), timestamp(delivered['at']))
        else:
            warnings.append('La entrega precede a la aceptación; lead time excluido.')
    elif delivered:
        warnings.append('Falta la primera aceptación; no se infiere desde la creación de la Issue.')
    if requested and review:
        wait = business_days(timestamp(requested['at']), timestamp(review['at']))
    elif any(e.get('review_started') and e['event'] == 'labeled' for e in events) and not requested:
        warnings.append('Falta solicitud de revisión; espera excluida.')
    elif requested and any(e.get('review_started') and e['event'] == 'labeled'
                           for e in events[:events.index(requested)]):
        warnings.append('revision:iniciada precede a la solicitud de revisión; espera excluida. '
                        'Retirar y volver a añadir la etiqueta al comenzar la revisión.')
    if delivered and not validation:
        warnings.append('Entrega sin entrada a validación; %CA no calculable para esta tarea.')
    if issue.get('state') == 'closed' and not delivered:
        warnings.append('Issue cerrada sin etapa Entregada; no se considera entrega validada.')
    if not key:
        warnings.append('Falta código de tarea; no se agrupa con TA/DT.')
    in_progress = not delivered and issue.get('state') != 'closed'
    age = business_days(timestamp(accepted['at']), now) if accepted and in_progress else None
    accumulated_wait = (business_days(timestamp(requested['at']), now)
                        if requested and not review and in_progress else None)
    return dict(task=key, group=group, issue=issue['number'], url=issue['html_url'],
                state=changes[-1]['state'] if changes else 'Sin registro',
                accepted_at=accepted['at'] if accepted else '', delivered_at=delivered['at'] if delivered else '',
                review_requested_at=requested['at'] if requested else '', review_started_at=review['at'] if review else '',
                first_validation=validation_result, lead_days=lead, review_wait_days=wait,
                open_age_days=age, pending_review_days=accumulated_wait,
                reopened=sum(e['event'] == 'reopened' for e in events), warnings='; '.join(warnings))


def summarize(rows):
    result = {}
    for group in ('G', 'TA', 'DT'):
        subset = [r for r in rows if r['group'] == group]
        lead = [r['lead_days'] for r in subset if r['lead_days'] is not None]
        wait = [r['review_wait_days'] for r in subset if r['review_wait_days'] is not None]
        validation = [r for r in subset if r['first_validation'] in ('aceptada', 'rechazada')]
        good = sum(r['first_validation'] == 'aceptada' for r in validation)
        result[group] = dict(tasks=len(subset), lead_n=len(lead),
                             median_lead_days=statistics.median(lead) if lead else None,
                             review_n=len(wait), review_within_two_days=sum(w <= 2 for w in wait),
                             review_within_two_pct=100 * sum(w <= 2 for w in wait) / len(wait) if wait else None,
                             first_validation_n=len(validation), first_accepted_n=good,
                             first_accepted_pct=100 * good / len(validation) if validation else None)
    return result


def report(api, repo):
    issues = api.pages(f'repos/{repo}/issues?state=all&labels=pswe07,tipo%3Atarea')
    snapshots, rows, all_events = [], [], []
    now = datetime.now(ZONE)
    for issue in issues:
        names = {label['name'] for label in issue['labels']}
        if 'pull_request' in issue or 'pswe07:prueba' in names:
            continue
        timeline = api.pages(f'repos/{repo}/issues/{issue["number"]}/timeline')
        events = normalize_events(issue, timeline)
        row = calculate(issue, events, now)
        rows.append(row)
        all_events.extend(events)
        snapshots.append(dict(issue=issue, events=events, last=latest_stage(events)))
    summary = summarize(rows)
    comparison = summarize([r for r in rows if r['task'] in {'TA-02', 'TA-03', 'DT-02', 'DT-03'}])
    summary['implementation_comparison'] = {g: comparison[g] for g in ('TA', 'DT')}
    return dict(generated_at=now.isoformat(), rows=rows, events=all_events, summary=summary), snapshots


def save_report(data, output):
    output.mkdir(parents=True, exist_ok=True)
    (output / 'eventos.json').write_text(json.dumps(data['events'], ensure_ascii=False, indent=2)+'\n')
    (output / 'resumen.json').write_text(json.dumps({k:v for k,v in data.items() if k != 'events'}, ensure_ascii=False, indent=2)+'\n')
    if data['rows']:
        with (output / 'metricas.csv').open('w', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=list(data['rows'][0]))
            writer.writeheader()
            writer.writerows(data['rows'])
    else:
        (output / 'metricas.csv').write_text('task,group,issue,state,lead_days,review_wait_days,first_validation\n')
    def show(value):
        return 'Sin datos' if value is None else f'{value:.2f}'
    lines = ['Reporte del proceso PSWE-07', '', f'Generado: {data["generated_at"]}', '',
             '| Grupo | Tareas | Mediana lead time (días hábiles) | Revisión ≤2 días (%) | Primera aceptación (%) |',
             '|---|---:|---:|---:|---:|']
    for group in ('G','TA','DT'):
        s = data['summary'][group]
        lines.append(f'| {group} | {s["tasks"]} | {show(s["median_lead_days"])} (n={s["lead_n"]}) | {show(s["review_within_two_pct"])} (n={s["review_n"]}) | {show(s["first_accepted_pct"])} ({s["first_accepted_n"]}/{s["first_validation_n"]}) |')
    lines += ['', 'Sin datos significa que falta completar el evento, no un resultado de cero.',
              'La comparación de implementación y el detalle por tarea están en resumen.json y metricas.csv.',
              'Los eventos provienen del historial de etiquetas; no se infieren horas trabajadas.', '']
    for row in data['rows']:
        if row['warnings']:
            lines.append(f'- {row["task"] or row["issue"]}: {row["warnings"]}')
    (output / 'reporte.md').write_text('\n'.join(lines)+'\n')


def sync(api, project_api, repo, owner, number, snapshots):
    query = '''query($login:String!,$number:Int!){repositoryOwner(login:$login){
      ... on User{projectV2(number:$number){id}} ... on Organization{projectV2(number:$number){id}}}}'''
    owner_data = project_api.gql(query, login=owner, number=number)['repositoryOwner']
    if not owner_data or not owner_data.get('projectV2'):
        raise ValueError('Proyecto inexistente o token sin acceso.')
    pid = owner_data['projectV2']['id']
    fields = project_api.gql(FIELDS_QUERY, id=pid)['node']['fields']['nodes']
    status = next(f for f in fields if f.get('name') == 'Status')
    options = {option['name']: option['id'] for option in status['options']}
    items = project_items(project_api, pid)
    missing = []
    for snapshot in snapshots:
        issue, latest = snapshot['issue'], snapshot['last']
        if not latest:
            continue
        # Reconstruir antes de modificar: no usar un snapshot si hubo otra transición.
        fresh = normalize_events(issue, api.pages(f'repos/{repo}/issues/{issue["number"]}/timeline'))
        newest = latest_stage(fresh)
        if not newest or newest['event_id'] != latest['event_id']:
            print(f'Issue {issue["number"]}: cambio concurrente; se sincronizará en la próxima ejecución.')
            continue
        item = items.get(issue['node_id'])
        if not item:
            print(f'Issue {issue["number"]} no está en el proyecto; se omite su sincronización.')
            missing.append(issue['number'])
            continue
        current = next((value.get('name') for value in item['fieldValues']['nodes']
                        if (value.get('field') or {}).get('id') == status['id']), None)
        if latest['state'] not in options:
            raise ValueError(f'Falta el estado {latest["state"]}. Configure esa opción en el campo Status del proyecto.')
        if current != latest['state']:
            project_api.mutation('updateProjectV2ItemFieldValue', 'UpdateProjectV2ItemFieldValueInput',
                                 dict(projectId=pid, itemId=item['id'], fieldId=status['id'],
                                      value=dict(singleSelectOptionId=options[latest['state']])), 'projectV2Item{id}')
        current_issue = api.call(f'repos/{repo}/issues/{issue["number"]}')
        for label in current_issue['labels']:
            if label['name'] in EVENT_STATES and label['name'] != latest['label']:
                api.call(f'repos/{repo}/issues/{issue["number"]}/labels/{quote(label["name"], safe="")}', 'DELETE')
    # La entrega y el cierre son decisiones del validador, no del bot ni del merge.
    if missing:
        raise ValueError('Añada al proyecto las incidencias ' + ', '.join(f'#{n}' for n in missing) + '.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default=os.getenv('GITHUB_REPOSITORY', 'agvor/mattermost'))
    parser.add_argument('--output', type=Path, default=Path(__file__).parent/'salida')
    parser.add_argument('--sync-project', action='store_true')
    parser.add_argument('--project-owner', default=os.getenv('PSWE07_PROJECT_OWNER') or 'agvor')
    parser.add_argument('--project-number', type=int, default=int(os.getenv('PSWE07_PROJECT_NUMBER') or 0))
    args = parser.parse_args()
    try:
        api = GitHub()
        data, snapshots = report(api, args.repo)
        save_report(data, args.output)
        print((args.output/'reporte.md').read_text())
        if args.sync_project:
            if not args.project_number:
                raise ValueError('Configure PSWE07_PROJECT_NUMBER con el número del proyecto.')
            token = os.getenv('PSWE07_PROJECT_TOKEN')
            if os.getenv('GITHUB_ACTIONS') == 'true' and not token:
                raise ValueError('Falta el secreto PSWE07_PROJECT_TOKEN. El reporte se generó, pero no se sincronizó el tablero.')
            sync(api, GitHub(token=token), args.repo, args.project_owner, args.project_number, snapshots)
    except (RuntimeError, ValueError, KeyError, StopIteration) as error:
        print(f'No se completó la medición/sincronización: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
