import { redirect } from 'next/navigation'

export default function LocationIndexPage({ params }: { params: { locationCode: string } }) {
  redirect(`/dashboard/${params.locationCode}/fase-1`)
}
