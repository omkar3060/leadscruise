import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import "./TotalLeadsToday.css"; // Reuse same CSS

const TotalLeadsThisWeek = () => {
  const [weekLeads, setWeekLeads] = useState([]);

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

        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Start from Sunday
        startOfWeek.setHours(0, 0, 0, 0);

        const filtered = data.filter((lead) => {
          const leadDate = new Date(lead.createdAt);
          return leadDate >= startOfWeek;
        });

        setWeekLeads(filtered);
      } catch (error) {
        console.error("Error fetching weekly leads:", error);
      }
    };

    fetchLeads();
  }, []);

  const exportToExcel = () => {
    const cleanedLeads = weekLeads.map(({ _v, ...rest }, index) => ({
      "S.No": index + 1,
      ...rest
    }));
    const worksheet = XLSX.utils.json_to_sheet(cleanedLeads);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Total Leads This Week");
    
    const today = new Date().toISOString().split("T")[0];
    const filename = `Total Leads This Week_${today}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="leads-container">
      <h2>Total Leads Captured This Week</h2>
      <div className="download-and-back-div">
        <button className="excel-btn" onClick={exportToExcel}>Download</button>
        <button className="back-btn" onClick={() => window.history.back()}>
          Back
        </button>
      </div>

      <div className="table-container1">
        {weekLeads.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th className="slno-col">Sl No</th>
                <th>Product</th>
                <th>Address</th>
                <th>Name</th>
                <th>Mobile Number</th>
                <th>Email</th>
                <th>Purchase Date</th>
              </tr>
            </thead>
            <tbody>
              {weekLeads.map((lead, index) => (
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
          <p style={{ textAlign: "center" }}>No leads captured this week.</p>
        )}
      </div>
    </div>
  );
};

export default TotalLeadsThisWeek;