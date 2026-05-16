import { X } from 'lucide-react'
import React from 'react'

type Props = {
  open: boolean
  title?: string
  onClose: () => void
  children: React.ReactNode
}

export default function AssignTeachersModal({
  open,
  title = 'Assigned Teachers',
  onClose,
  children,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* scroll container */}
      <div className="relative h-full overflow-y-auto">
        <div
          className="
            flex
            min-h-full
            items-start
            justify-center
            p-3
            sm:p-6
            lg:p-10
          "
        >
          {/* modal */}
          <div
            className="
              w-[95vw]
              sm:w-[92vw]
              md:w-[850px]
              lg:w-[980px]
              xl:w-[1100px]
              max-w-[1100px]

              rounded-2xl
              bg-white
              shadow-2xl

              flex
              flex-col

              overflow-visible
              max-h-[92vh]
            "
          >
            {/* header */}
            <div
              className="
                shrink-0
                flex
                items-center
                justify-between
                border-b
                px-4
                py-4
                sm:px-6
              "
            >
              <h2 className="text-lg font-semibold">
                {title}
              </h2>

              <button
                onClick={onClose}
                className="
                  rounded-lg
                  p-2
                  hover:bg-slate-100
                "
              >
                <X size={20} />
              </button>
            </div>

            {/* body */}
            <div
              className="
                flex-1
                overflow-y-auto
                overflow-x-visible
                px-4
                py-4
                sm:px-6
              "
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}