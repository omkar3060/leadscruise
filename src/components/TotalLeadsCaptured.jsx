import React, { useEffect, useState } from "react";
import Dither from "./Dither.tsx";
import axios from "axios";
import * as XLSX from "xlsx";
import "./TotalLeadsToday.css"; // Reuse same CSS

console.log("🔥 TotalLeadsAllTime component loaded - VERSION 2.0");

const TotalLeadsAllTime = () => {
  const [allLeads, setAllLeads] = useState([]);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const mobileNumber = localStorage.getItem("mobileNumber");
        if (!mobileNumber) {
          console.error("Mobile number not found in localStorage.");
          return;
        }

        const response = await axios.get(`https://api.leadscruise.com/api/get-user-leads/${mobileNumber}`);
        const data = response.data.leads;

        setAllLeads(data);
      } catch (error) {
        console.error("Error fetching all leads:", error);
      }
    };

    fetchLeads();
  }, []);

  const exportToExcel = () => {
    const cleanedLeads = allLeads.map(({ _v, ...rest }, index) => ({
      "S.No": index + 1,
      ...rest
    }));
    const worksheet = XLSX.utils.json_to_sheet(cleanedLeads);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Total Leads Captured");
    
    const today = new Date().toISOString().split("T")[0];
    const filename = `Total Leads Captured_${today}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
  };

  return (
    <>
    {/* Dither Background */}
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      zIndex: -1
    }}>
      <Dither
        waveColor={[51/255, 102/255, 128/255]}
        disableAnimation={false}
        enableMouseInteraction={true}
        mouseRadius={0.3}
        colorNum={5}
        waveAmplitude={0.25}
        waveFrequency={2.5}
        waveSpeed={0.03}
        pixelSize={2.5}
      />
    </div>
    <div className="leads-container">
      <h2>All Captured Leads</h2>
      <div className="download-and-back-div">
        <button className="excel-btn" onClick={exportToExcel}>Download</button>
        <button className="back-btn" onClick={() => window.history.back()}>
          Back
        </button>
      </div>

      <div className="table-container1">
        {allLeads.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th className="slno-col">Sl.No.</th>
                <th>Product</th>
                <th>Address</th>
                <th>Name</th>
                <th>Mobile Number</th>
                <th>Email</th>
                <th>Purchase Date</th>
              </tr>
            </thead>
            <tbody>
              {allLeads.map((lead, index) => (
                <tr key={lead._id || index}>
                  <td>{index + 1}</td>
                  <td>{lead.lead_bought || "N/A"}</td>
                  <td>{lead.address || "N/A"}</td>
                  <td>{lead.name || "N/A"}</td>
                  <td>{lead.mobile || "N/A"}</td>
                  <td>{lead.email || "N/A"}</td>
                  <td>
                    {lead.createdAt
                      ? new Date(lead.createdAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata"
                        })
                      : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ textAlign: "center" }}>No leads found.</p>
        )}
      </div>
    </div>
    </>
  );
};

export default TotalLeadsAllTime;