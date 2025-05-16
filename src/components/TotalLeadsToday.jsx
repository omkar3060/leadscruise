import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import "./TotalLeadsToday.css"; // Reuse same CSS

const TotalLeadsToday = () => {
  const [todayLeads, setTodayLeads] = useState([]);

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

        const today = new Date().toISOString().split("T")[0];

        const filtered = data.filter((lead) => {
          const leadDate = new Date(lead.createdAt).toISOString().split("T")[0];
          return leadDate === today;
        });

        setTodayLeads(filtered);
      } catch (error) {
        console.error("Error fetching today's leads:", error);
      }
    };

    fetchLeads();
  }, []);

  const exportToExcel = () => {
    const cleanedLeads = todayLeads.map(({ _v, ...rest }) => rest);  // This removes the _v field
    const worksheet = XLSX.utils.json_to_sheet(cleanedLeads);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TodayLeads");
    XLSX.writeFile(workbook, "TotalLeadsToday.xlsx");
  };
  

  return (
    <div className="leads-container">
      <h2>Total Leads Captured Today</h2>
      <div className="download-and-back-div">
        <button className="excel-btn" onClick={exportToExcel}>Download</button>
        <button className="back-btn" onClick={() => window.location.href = "/dashboard"}>
            Back
        </button>
      </div>

      <div className="table-container1">
        {todayLeads.length > 0 ? (
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
              {todayLeads.map((lead, index) => (
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
        ) : (
          <p style={{ textAlign: "center" }}>No leads captured today.</p>
        )}
      </div>
    </div>
  );
};

export default TotalLeadsToday;
