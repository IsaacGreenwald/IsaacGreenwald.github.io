import React from 'react';
import ghub from '../assets/ghub.png'; 
import lnk from '../assets/lnk.png'; 

const Contact = () => {
  return (
    <div className="contact">
      <h2>Contact Me</h2>
      <div className="contact-info">
        <p>igreenwald28@gmail.com</p>
      </div>
      <div className="social-links">
        <a
          href="https://github.com/IsaacGreenwald"
          target="_blank"
          rel="noopener noreferrer"
          className="social-link"
        >
          <img src={ghub} alt="GitHub" className="social-logo" />
        </a>
        <a
          href="www.linkedin.com/in/isaac-greenwald"
          target="_blank"
          rel="noopener noreferrer"
          className="social-link"
        >
          <img src={lnk} alt="LinkedIn" className="social-logo" />
        </a>
      </div>
    </div>
  );
};

export default Contact;