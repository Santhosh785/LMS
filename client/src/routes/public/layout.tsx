import PublicLayout from '../../layouts/PublicLayout.jsx'
import RouteErrorView from '../../components/RouteErrorView'

export default PublicLayout

/** A broken public page keeps the header and footer. */
export function ErrorBoundary() {
  return (
    <PublicLayout>
      <RouteErrorView scope="route" />
    </PublicLayout>
  )
}
