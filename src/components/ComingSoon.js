import React from "react";
import styled, { keyframes } from "styled-components";
import { motion } from "framer-motion";
import Sidebar from "./Sidebar";
// Keyframes for glow animation
const glow = keyframes`
  0% { box-shadow: 0 0 10px rgba(255, 255, 255, 0.2); }
  50% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.4); }
  100% { box-shadow: 0 0 10px rgba(255, 255, 255, 0.2); }
`;

// Styled components
const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  // background: linear-gradient(to right, #0f0c29, #302b63, #24243e);
`;

const Card = styled(motion.div)`
 background:rgb(25, 89, 237);
  backdrop-filter: blur(10px);
  padding: 40px;
  border-radius: 20px;
  text-align: center;
  border: 2px solid rgba(255, 255, 255, 0.2);
  animation: ${glow} 3s infinite alternate;
`;

const Title = styled(motion.h1)`
  font-size: 36px;
  color: #fff;
  margin-bottom: 10px;
`;

const Subtitle = styled(motion.p)`
  font-size: 18px;
  color: #ddd;
  margin-bottom: 20px;
`;

const Underline = styled(motion.div)`
  width: 60px;
  height: 4px;
  background: #ff7b54;
  margin: 10px auto;
  border-radius: 2px;
`;

const ComingSoon = () => {
    const status=localStorage.getItem("status");
  return (
    <Container>
        <Sidebar status={status} />
      <Card
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <Title
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Coming Soon
        </Title>
        <Subtitle
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          We're working on something amazing! Stay tuned.
        </Subtitle>
        <Underline
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        />
      </Card>
    </Container>
  );
};

export default ComingSoon;
