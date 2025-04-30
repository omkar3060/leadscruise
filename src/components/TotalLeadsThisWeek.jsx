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

        const response = await axios.get(`https://api.leadscruise.com/api/get-leads/${mobileNumber}`);
        const data = response.data;

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
    const cleanedLeads = weekLeads.map(({ _v, ...rest }) => rest);  // This removes the _v field
    const worksheet = XLSX.utils.json_to_sheet(cleanedLeads);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "WeeklyLeads");
    XLSX.writeFile(workbook, "TotalLeadsThisWeek.xlsx");
  };
  
  return (
    <div className="container">
      <h2>Total Leads Captured This Week</h2>
      <div className="download-and-back-div">
        <button className="excel-btn" onClick={exportToExcel}>Download</button>
        <button className="back-btn" onClick={() => window.location.href = "/dashboard"}>
            Back
        </button>
      </div>

      <div className="table-container1">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Name</th>
              <th>Mobile Number</th>
              <th>Email</th>
              <th>Purchase Date</th>
            </tr>
          </thead>
          <tbody>
            {weekLeads.map((lead, index) => (
              <tr key={index}>
                <td>{lead.lead_bought || "N/A"}</td>
                <td>{lead.name || "N/A"}</td>
                <td>{lead.mobile || "N/A"}</td>
                <td>{lead.email || "N/A"}</td>
                <td>{new Date(lead.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {weekLeads.length === 0 && <p style={{ textAlign: "center" }}>No leads captured this week.</p>}
      </div>
    </div>
  );
};

export default TotalLeadsThisWeek;
