interface UpcomingActivity {
  id: string
  kegiatan: string
  pic: string
  tanggalMulaiRencana: string
}

interface UpcomingActivitiesPanelProps {
  activities: UpcomingActivity[]
}

export function UpcomingActivitiesPanel({ activities }: UpcomingActivitiesPanelProps) {
  if (activities.length === 0) {
    return <p className="text-sm text-gray-500">Tidak ada kegiatan mendatang.</p>
  }

  return (
    <ul className="divide-y divide-gray-100">
      {activities.map((activity) => (
        <li key={activity.id} className="py-2 flex justify-between text-sm">
          <span className="text-gray-900">{activity.kegiatan}</span>
          <span className="text-gray-500">
            {activity.pic} · {activity.tanggalMulaiRencana}
          </span>
        </li>
      ))}
    </ul>
  )
}
