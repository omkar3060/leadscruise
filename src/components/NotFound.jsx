import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

const NotFound = () => {
  const status = localStorage.getItem("status");
  const [htmlContent, setHtmlContent] = useState("");

  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/404/index.html`) // adjust the path if renamed or moved
      .then((res) => res.text())
      .then((html) => {
        setHtmlContent(html);
      })
      .catch((err) => {
        console.error("Failed to load HTML:", err);
      });
  }, []);

  return (
    <div>
      <div
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        style={{ padding: "20px", backgroundColor: "#ffffff" }}
      />
    </div>
  );
};

export default NotFound;
