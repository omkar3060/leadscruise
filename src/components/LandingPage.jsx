import React from "react";

const LandingPage = ({ page }) => {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <iframe
        key={page} // important so React reloads iframe when route changes
        src={`/assets_shashank/${page}`}
        title={page}
        width="100%"
        height="100%"
        style={{ border: "none", display: "block" }}
      ></iframe>
    </div>
  );
};

export default LandingPage;
