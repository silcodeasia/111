/**
 * Общие колонки DataGrid для вакансий (используются на /stores и /plan).
 * @param {boolean} editable — разрешено ли inline-редактирование
 */
export function vacancyColumns(editable) {
  return [
    { field: 'position', headerName: 'Должность', flex: 1, minWidth: 200, editable },
    {
      field: 'category', headerName: 'Категория', width: 120, editable,
      type: 'singleSelect', valueOptions: ['АУП', 'Линейка'],
    },
    { field: 'staff_units', headerName: 'Ставок', width: 90, type: 'number', editable },
    { field: 'zup_count', headerName: 'ЗУП', width: 80, type: 'number', editable },
    { field: 'neof', headerName: 'Неоф', width: 80, type: 'number', editable },
    { field: 'stazhirovka', headerName: 'Стажёры', width: 90, type: 'number', editable },
    { field: 'plan', headerName: 'План', width: 80, type: 'number', editable },
    {
      field: 'status', headerName: 'Статус', width: 130, editable,
      type: 'singleSelect', valueOptions: ['вакансия', 'ОК', 'ИСПРАВИТЬ'],
    },
    { field: 'planned_date', headerName: 'Дата', width: 110, editable },
    { field: 'reason', headerName: 'Причина', flex: 1, minWidth: 160, editable },
  ]
}
