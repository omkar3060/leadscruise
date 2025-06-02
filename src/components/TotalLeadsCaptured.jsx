import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import "./TotalLeadsToday.css"; // Reuse same CSS

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

        const response = await axios.get(`http://localhost:5000/api/get-leads/${mobileNumber}`);
        const data = response.data;

        setAllLeads(data);
      } catch (error) {
        console.error("Error fetching all leads:", error);
      }
    };

    fetchLeads();
  }, []);

  const exportToExcel = () => {
    const cleanedLeads = allLeads.map(({ _v, ...rest }) => rest);  // Remove _v
    const worksheet = XLSX.utils.json_to_sheet(cleanedLeads);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AllLeads");
    XLSX.writeFile(workbook, "TotalLeadsAllTime.xlsx");
  };

  return (
    <div className="leads-container">
      <h2>All Captured Leads</h2>
      <div className="download-and-back-div">
        <button className="excel-btn" onClick={exportToExcel}>Download</button>
        <button className="back-btn" onClick={() => window.location.href = "/dashboard"}>
          Back
        </button>
      </div>

      <div className="table-container1">
        {allLeads.length > 0 ? (
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
              {allLeads.map((lead, index) => (
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
          <p style={{ textAlign: "center" }}>No leads found.</p>
        )}
      </div>
    </div>
  );
};

export default TotalLeadsAllTime;
