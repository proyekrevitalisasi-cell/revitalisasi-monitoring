export interface NationalHoliday {
  holiday_date: string
  name: string
}

export const NATIONAL_HOLIDAYS: Record<2026 | 2027, NationalHoliday[]> = {
  2026: [
    { holiday_date: '2026-01-01', name: 'Tahun Baru Masehi 2026' },
    { holiday_date: '2026-01-29', name: 'Tahun Baru Imlek 2577 Kong Zi' },
    { holiday_date: '2026-02-18', name: 'Isra Mikraj Nabi Muhammad SAW 1447 H' },
    { holiday_date: '2026-03-22', name: 'Hari Suci Nyepi – Tahun Baru Saka 1948' },
    { holiday_date: '2026-04-03', name: 'Wafat Isa Al Masih' },
    { holiday_date: '2026-04-20', name: 'Cuti Bersama Idul Fitri 1447 H' },
    { holiday_date: '2026-04-21', name: 'Hari Raya Idul Fitri 1447 H' },
    { holiday_date: '2026-04-22', name: 'Hari Raya Idul Fitri 1447 H Hari ke-2' },
    { holiday_date: '2026-04-23', name: 'Cuti Bersama Idul Fitri 1447 H' },
    { holiday_date: '2026-04-24', name: 'Cuti Bersama Idul Fitri 1447 H' },
    { holiday_date: '2026-05-14', name: 'Kenaikan Yesus Kristus' },
    { holiday_date: '2026-05-23', name: 'Hari Raya Waisak 2570 BE' },
    { holiday_date: '2026-06-06', name: 'Hari Raya Idul Adha 1447 H' },
    { holiday_date: '2026-06-26', name: 'Tahun Baru Islam 1448 H' },
    { holiday_date: '2026-08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
    { holiday_date: '2026-09-04', name: 'Maulid Nabi Muhammad SAW 1448 H' },
    { holiday_date: '2026-12-25', name: 'Hari Raya Natal' },
    { holiday_date: '2026-12-26', name: 'Cuti Bersama Natal' },
  ],
  2027: [
    { holiday_date: '2027-01-01', name: 'Tahun Baru Masehi 2027' },
    { holiday_date: '2027-01-17', name: 'Tahun Baru Imlek 2578 Kong Zi' },
    { holiday_date: '2027-02-07', name: 'Isra Mikraj Nabi Muhammad SAW 1448 H' },
    { holiday_date: '2027-03-11', name: 'Hari Suci Nyepi – Tahun Baru Saka 1949' },
    { holiday_date: '2027-03-26', name: 'Wafat Isa Al Masih' },
    { holiday_date: '2027-04-10', name: 'Hari Raya Idul Fitri 1448 H' },
    { holiday_date: '2027-04-11', name: 'Hari Raya Idul Fitri 1448 H Hari ke-2' },
    { holiday_date: '2027-05-03', name: 'Kenaikan Yesus Kristus' },
    { holiday_date: '2027-05-12', name: 'Hari Raya Waisak 2571 BE' },
    { holiday_date: '2027-05-27', name: 'Hari Raya Idul Adha 1448 H' },
    { holiday_date: '2027-06-15', name: 'Tahun Baru Islam 1449 H' },
    { holiday_date: '2027-08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
    { holiday_date: '2027-08-24', name: 'Maulid Nabi Muhammad SAW 1449 H' },
    { holiday_date: '2027-12-25', name: 'Hari Raya Natal' },
    { holiday_date: '2027-12-26', name: 'Cuti Bersama Natal' },
  ],
}
