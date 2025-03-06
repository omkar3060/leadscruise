import React from "react";

const LandingPage = () => {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <iframe
        src={`/assets_shashank/assets_shashank/index.html`}
        title="Landing Page"
        width="100%"
        height="100%"
        style={{ border: "none", display: "block" }}
      ></iframe>
    </div>
  );
};

export default LandingPage;
