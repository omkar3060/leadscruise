import React, { useState, useEffect } from "react";
import DashboardHeader from "./DashboardHeader";
import Sidebar from "./Sidebar";
import "./Analytics.css";
import styles from "./Dashboard.module.css";
import demoAnalytics from "../data/demoAnalytics";

const LoadingScreen = () => (
    <div className="loading-overlay">
        <div className="loading-container">
            <div className="spinner">
                <div className="double-bounce1"></div>
                <div className="double-bounce2"></div>
            </div>
            <div className="loading-text">
                <h3>Loading...</h3>
                <div className="loading-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                </div>
            </div>
            <p className="loading-message">Please wait</p>
        </div>
    </div>
);

export default function Analytics() {
    const [chartData, setChartData] = useState({
        weekly: null,
        monthly: null
    });
    const [tableData, setTableData] = useState({
        locations: [],
        categories: [] // For future implementation
    });
    const [activeChart, setActiveChart] = useState('weekly');
    const [activeTable, setActiveTable] = useState('locations');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const status = localStorage.getItem("status");

    useEffect(() => {
        const mobileNumber = localStorage.getItem("mobileNumber");
        const savedPassword = localStorage.getItem("savedPassword");
        if (mobileNumber === "9999999999") {
            console.log("Demo account detected, setting demo data.");
            setChartData({
                weekly: "data:image/png;base64," + demoAnalytics.charts.weekly,
                monthly: "data:image/png;base64," + demoAnalytics.charts.monthly,
            });
            setTableData({
                locations: demoAnalytics.tables.locations || [],
                categories: demoAnalytics.tables.categories || []
            });
            setIsLoading(false);
            return;
        }
        if (!mobileNumber || !savedPassword) {
            setError("Missing credentials in local storage.");
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch charts and tables data from the API

                const response = await fetch(
                    `https://api.leadscruise.com/api/analytics/charts?mobileNumber=${mobileNumber}&savedPassword=${savedPassword}`
                );

                const data = await response.json();

                if (data.success) {
                    // Set chart data
                    setChartData({
                        weekly: "data:image/png;base64," + data.charts.weekly,
                        monthly: "data:image/png;base64," + data.charts.monthly,
                    });

                    // Set table data from API response
                    setTableData({
                        locations: data.tables.locations || [],
                        categories: data.tables.categories || []
                    });
                } else {
                    throw new Error(data.message || data.error || "Unknown error");
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        // Handle window resize for responsive layout
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
            if (window.innerWidth > 768 && !sidebarOpen) {
                setSidebarOpen(true);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleChartToggle = (period) => {
        setActiveChart(period);
    };

    const handleTableToggle = (tableType) => {
        setActiveTable(tableType);
    };

    if (isLoading) return <LoadingScreen />;
    if (error) return <div className="error-message">{error}</div>;
    if (!chartData.weekly && !chartData.monthly) return null;

    return (
        <div className="settings-page-wrapper">
            {(windowWidth > 768 || sidebarOpen) && <Sidebar status={status} />}
            <DashboardHeader
                style={windowWidth <= 768 ? {
                    left: 0,
                    width: "100%",
                    marginLeft: 0,
                    padding: "15px"
                } : {}}
            />
            <div className="analytics-container">
                <h2>Leads Provider Analytics</h2>

                {/* Chart Section */}
                <div className="chart-section">
                    <div className="chart-selection">
                        <button
                            type="button"
                            className={activeChart === 'weekly' ? "button-selected" : "button-not-selected"}
                            onClick={() => handleChartToggle('weekly')}
                        >
                            Weekly
                        </button>
                        <button
                            type="button"
                            className={activeChart === 'monthly' ? "button-selected" : "button-not-selected"}
                            onClick={() => handleChartToggle('monthly')}
                        >
                            Monthly
                        </button>
                    </div>

                    <div className="chart-container">
                        {chartData[activeChart] && (
                            <img
                                src={chartData[activeChart]}
                                alt={`${activeChart.charAt(0).toUpperCase() + activeChart.slice(1)} analytics chart from IndiaMART`}
                                style={{ maxWidth: "70%", height: "150px", margin: "0 auto", display: "block" }}
                            />
                        )}
                        <div className="chart-message">
                            Graph shows Enquiries via Calls, Emails &amp; Leads Consumed
                        </div>
                    </div>
                </div>

                {/* Table Section - Modified for side-by-side display */}
                <div className="tables-container">
                    {/* Categories Table */}
                    <div className={`${styles.leadsTable} table-section`}>
                        <div className="table-title">Top Categories</div>
                        <div>
                            <div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Category</th>
                                            <th style={{ textAlign: 'center' }}>Leads Consumed</th>
                                            <th style={{ textAlign: 'center' }}>Enquiries</th>
                                            <th style={{ textAlign: 'center' }}>Calls</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableData.categories.length > 0 ? (
                                            tableData.categories.map((item, index) => (
                                                <tr key={index}>
                                                    <td style={{ textAlign: 'left', paddingLeft: '0.5rem', paddingRight: '1.25rem' }}>
                                                        {item.category}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>{item.leadsConsumed}</td>
                                                    <td style={{ textAlign: 'center' }}>{item.enquiries}</td>
                                                    <td style={{ textAlign: 'center' }}>{item.calls}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '1rem' }}>
                                                    No category data available
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Locations Table */}
                    <div className={`${styles.leadsTable} table-section`}>
                        <div className="table-title">Top Locations</div>
                        <div>
                            <div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Location</th>
                                            <th style={{ textAlign: 'center' }}>Leads Consumed</th>
                                            <th style={{ textAlign: 'center' }}>Enquiries</th>
                                            <th style={{ textAlign: 'center' }}>Calls</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableData.locations.map((item, index) => (
                                            <tr key={index}>
                                                <td style={{ textAlign: 'left', paddingLeft: '0.5rem', paddingRight: '1.25rem' }}>
                                                    {item.location}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>{item.leadsConsumed}</td>
                                                <td style={{ textAlign: 'center' }}>{item.enquiries}</td>
                                                <td style={{ textAlign: 'center' }}>{item.calls}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
