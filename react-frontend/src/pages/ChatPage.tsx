import { PageHeader } from '../components/PageHeader'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export function ChatPage() {
  return (
    <section className="flex flex-col gap-5 h-dvh max-h-screen w-full">
      <PageHeader title="Chat Page" />
      <div className="page-row flex flex-col items-center justify-center h-full gap-12">
        <h2 className="text-4xl font-medium tracking-tight">Good Morning, Chris</h2>
        <div className="w-3/4 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-sm rounded-lg p-6 flex items-start gap-6">
          <textarea className="flex-1 h-12 resize-none" placeholder="Ask me anything..."></textarea>
          <div className="h-12 w-12 border rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer">
            <FontAwesomeIcon icon={faArrowUp} />
          </div>
        </div>
        <div className="w-3/4 flex flex-col items-start gap-4">
          <h3 className="text-xl text-left self-start">Recent Queries</h3>
          <div className="w-full flex gap-6">
            <div className="flex flex-col gap-1">
              <div className="text-sm text-neutral-500">2 hours ago</div>
              <div className="text-base text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-md shadow-sm">
                <div className="font-medium mb-1">Previous Month Sales</div>
                <div className="text-sm">Show me the sales orders for last month.</div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm text-neutral-500">1 day ago</div>
              <div className="text-base text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-md shadow-sm">
                <div className="font-medium mb-1">YTD Sales by Rep</div>
                <div className="text-sm">Show me sales by rep for the year to date.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}