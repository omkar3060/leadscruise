import React from 'react';
import styled, { keyframes } from 'styled-components';
import { Link } from 'react-router-dom';

// Bounce Animation
const bounceAnimation = keyframes`
  0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
  40% {transform: translateY(-30px);}
  60% {transform: translateY(-15px);}
`;

// Styled Components
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
//   background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
  font-family: 'Arial', sans-serif;
  width: 100vw;
`;

const ErrorCard = styled.div`
  background: white;
  border-radius: 20px;
  box-shadow: 0 15px 35px rgba(50,50,93,.1), 0 5px 15px rgba(0,0,0,.07);
  padding: 40px;
  text-align: center;
  max-width: 500px;
  width: 100%;
  border: 1px solid #e9ecef;
`;

const ErrorIcon = styled.div`
  color: #ff6b6b;
  font-size: 120px;
  margin-bottom: 20px;
  animation: ${bounceAnimation} 2s ease infinite;
`;

const ErrorTitle = styled.h1`
  font-size: 72px;
  color: #333;
  margin-bottom: 10px;
  font-weight: bold;
`;

const ErrorSubtitle = styled.h2`
  font-size: 36px;
  color: #555;
  margin-bottom: 20px;
`;

const ErrorMessage = styled.p`
  color: #6c757d;
  font-size: 18px;
  margin-bottom: 30px;
  line-height: 1.6;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
`;

const StyledLink = styled(Link)`
  display: inline-block;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
  transition: all 0.3s ease;
  
  &.dashboard {
    background-color: #4299e1;
    color: white;
    
    &:hover {
      background-color: #3182ce;
      transform: translateY(-3px);
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
  }
  
  &.home {
    background-color: #e2e8f0;
    color: #2d3748;
    
    &:hover {
      background-color: #cbd5e0;
      transform: translateY(-3px);
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
  }
`;

const NotFound = () => {
  return (
    <PageContainer>
      <ErrorCard>
        <ErrorIcon>⚠️</ErrorIcon>
        
        <ErrorTitle>404</ErrorTitle>
        
        <ErrorSubtitle>Page Not Found</ErrorSubtitle>
        
        <ErrorMessage>
          Oops! The page you're looking for doesn't exist. Make sure you typed the correct URL.
        </ErrorMessage>
        
        <ButtonContainer>
          <StyledLink 
            to="/dashboard" 
            className="dashboard"
          >
            Return to Dashboard
          </StyledLink>
          
          <StyledLink 
            to="/" 
            className="home"
          >
            Go to Home
          </StyledLink>
        </ButtonContainer>
      </ErrorCard>
    </PageContainer>
  );
};

export default NotFound;