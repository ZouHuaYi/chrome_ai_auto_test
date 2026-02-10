import React, { useState, useEffect } from 'react';

const SidePanel = () => {
  const [steps, setSteps] = useState([]);

  useEffect(() => {
    // 1. Load initial state from storage
    chrome.storage.local.get(['recorded_steps'], (result) => {
      if (result.recorded_steps && Array.isArray(result.recorded_steps)) {
        setSteps(result.recorded_steps);
      }
    });

    // 2. Listen for real-time updates
    const messageListener = (message) => {
      if (message.action === 'RECORD_STEP') {
        setSteps((prev) => [...prev, message.payload]);
      } else if (message.action === 'CLEAR_RECORDED_STEPS') {
        setSteps([]);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  const handleClear = () => {
    chrome.storage.local.set({ recorded_steps: [] }, () => {
      setSteps([]);
      // Notify background to clear storage if needed, though we just did it directly
      chrome.runtime.sendMessage({ action: 'CLEAR_RECORDED_STEPS' });
    });
  };

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif' }}>
      <h2>录制步骤 ({steps.length})</h2>
      <div style={{ marginBottom: '16px' }}>
        <button onClick={handleClear} style={{ cursor: 'pointer', padding: '4px 8px' }}>清空记录</button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {steps.map((step, index) => (
          <li key={index} style={{ 
            marginBottom: '8px', 
            padding: '8px', 
            background: '#f4f4f4', 
            borderRadius: '4px',
            fontSize: '12px',
            wordBreak: 'break-all'
          }}>
            <div style={{ fontWeight: 'bold', color: '#333' }}>
              {index + 1}. {step.type.toUpperCase()}
            </div>
            <div style={{ color: '#666', marginTop: '4px' }}>{step.target}</div>
            {step.value && <div style={{ color: '#0056b3', marginTop: '2px' }}>值: {step.value}</div>}
            {step.text && <div style={{ color: '#0056b3', marginTop: '2px' }}>文本: {step.text}</div>}
          </li>
        ))}
      </ul>
      {steps.length === 0 && (
        <div style={{ color: '#999', textAlign: 'center', marginTop: '20px' }}>
          <p>暂无记录</p>
          <p style={{ fontSize: '12px' }}>请在网页上进行点击或输入操作...</p>
        </div>
      )}
    </div>
  );
};

export default SidePanel;
