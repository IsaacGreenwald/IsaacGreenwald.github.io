import React from 'react';

const Experience = () => {
    const resumeUrl = `${process.env.PUBLIC_URL}/IsaacGreenwaldresume.pdf`;

  return (
    <div className="experience">
      <div className="experience-item">
        <h3>Software Engineer Intern</h3>
        <strong>Colorado College Artificial Intelligence Taskforce</strong> 
        <p>Developed and maintained web application providing teachers with analysis of AI utilization within their class. 
            Connected ChatGPT wrapper with AWS PostresQL database to store and retrieve important information. </p>
      </div>
      <div className="experience-item">
        <h3>Cybersecurity Researcher </h3>
        <strong>Montana State University</strong>
        <p>Worked with two other undergraduates during a ten week REU delving into the capabilities of Snort using Docker containers to simulate network traffic.</p>
      </div>
      <button
        className="resume-button"
        onClick={() => window.open(resumeUrl, '_blank')}
      > View Resume</button>
    </div>
  );
};

export default Experience;