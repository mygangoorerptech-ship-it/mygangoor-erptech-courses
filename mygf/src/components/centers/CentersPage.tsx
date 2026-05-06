//src/components/centers/CentersPage.tsx
import NavBar from "../home/NavBar";
import Footer from "../common/Footer";
import CentersHeader from "./CentersHeader";
import CentersStats from "./CentersStats";
import CentersList from "./CentersList";
import { useState } from "react";
import StudentSidebar from "../dashboard/StudentSidebar";

export default function CentersPage() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");

  return (
    <>
      <div className="relative z-20">
        <NavBar />
      </div>

      <div className="bg-slate-50 min-h-screen pt-16 sm:pt-20">

        <div className="flex">

          {/* SIDEBAR */}
          <StudentSidebar />

          {/* MAIN CONTENT */}
          <div className="flex-1 min-w-0">

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

              <CentersHeader
                query={query}
                setQuery={setQuery}
                region={region}
                setRegion={setRegion}
              />

              <CentersStats />

              <CentersList
                query={query}
                region={region}
              />

            </main>
          </div>
        </div>

      </div>

      <Footer brandName="ECA Academy" tagline="Learn smarter. Build faster." />
    </>
  );
}