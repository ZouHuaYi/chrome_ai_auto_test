import React, { useState, useEffect } from 'react';
import { parseMarkdown } from '../parser/markdown.js';
import { assemblePrompt } from '../prompt/assembler.js';
import { assembleUnifiedOutput } from '../prompt/unified.js';
import { executePlan } from '../executor/executor.js';
import { assertPlan } from '../assertions/assertor.js';

const SidePanel = () => {
  const [steps, setSteps] = useState([]);
  const [mdInput, setMdInput] = useState('');
  const [mdOutput, setMdOutput] = useState('');
  const [promptText, setPromptText] = useState('');
  const [planText, setPlanText] = useState('');
  const [unifiedText, setUnifiedText] = useState('');

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

      <hr style={{ margin: '20px 0' }} />

      <h3 style={{ marginBottom: '8px' }}>Markdown 解析预览</h3>
      <textarea
        value={mdInput}
        onChange={(e) => setMdInput(e.target.value)}
        placeholder="在这里粘贴或输入 Markdown..."
        rows={6}
        style={{ width: '100%', fontSize: '12px', padding: '8px', boxSizing: 'border-box' }}
      />
      <div style={{ margin: '8px 0' }}>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const parsed = parseMarkdown(mdInput || '')
            setMdOutput(JSON.stringify(parsed, null, 2))
          }}
        >
          解析
        </button>
      </div>
      <pre
        style={{
          background: '#111',
          color: '#0f0',
          padding: '8px',
          fontSize: '11px',
          borderRadius: '4px',
          maxHeight: '200px',
          overflow: 'auto'
        }}
      >
        {mdOutput || '解析结果将显示在这里...'}
      </pre>

      <div style={{ marginTop: '12px' }}>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            let docJson = {}
            try {
              docJson = mdOutput ? JSON.parse(mdOutput) : parseMarkdown(mdInput || '')
            } catch (e) {
              docJson = parseMarkdown(mdInput || '')
            }
            const prompt = assemblePrompt({ steps, docJson })
            setPromptText(prompt)
          }}
        >
          生成 Prompt
        </button>
      </div>

      <textarea
        value={promptText}
        readOnly
        rows={8}
        style={{
          width: '100%',
          fontSize: '12px',
          padding: '8px',
          boxSizing: 'border-box',
          marginTop: '8px'
        }}
        placeholder="Prompt 将显示在这里..."
      />

      <div style={{ marginTop: '12px' }}>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const exec = executePlan(steps)
            const asserts = assertPlan({ steps })
            const plan = {
              executor: exec,
              assertions: asserts
            }
            setPlanText(JSON.stringify(plan, null, 2))
          }}
        >
          生成执行计划
        </button>
      </div>
      <textarea
        value={planText}
        readOnly
        rows={6}
        style={{
          width: '100%',
          fontSize: '12px',
          padding: '8px',
          boxSizing: 'border-box',
          marginTop: '8px'
        }}
        placeholder="执行计划将显示在这里..."
      />

      <div style={{ marginTop: '12px' }}>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            let planJson = {}
            try {
              planJson = planText ? JSON.parse(planText) : {}
            } catch (e) {
              planJson = {}
            }
            const unified = assembleUnifiedOutput({ promptText, planJson })
            setUnifiedText(unified)
          }}
        >
          生成统一输出
        </button>
      </div>
      <textarea
        value={unifiedText}
        readOnly
        rows={8}
        style={{
          width: '100%',
          fontSize: '12px',
          padding: '8px',
          boxSizing: 'border-box',
          marginTop: '8px'
        }}
        placeholder="统一输出将显示在这里..."
      />
    </div>
  );
};

export default SidePanel;
