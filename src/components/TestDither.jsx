import React from "react";
import Dither from "./Dither.tsx";

const TestDither = () => {
  return (
    <>
      {/* Dither Background */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        zIndex: 0
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

      {/* Optional: Some content to see on top */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        color: 'white',
        fontSize: '48px',
        textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
      }}>
        <h1></h1>
      </div>
    </>
  );
};

export default TestDither;