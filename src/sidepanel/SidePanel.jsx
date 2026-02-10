import React, { useState, useEffect } from 'react';
import { parseMarkdown } from '../parser/markdown.js';
import { assemblePrompt } from '../prompt/assembler.js';
import { assembleUnifiedOutput } from '../prompt/unified.js';
import { executePlan } from '../executor/executor.js';
import { assertPlan } from '../assertions/assertor.js';
import { generateAssertionTemplate } from '../assertions/template.js';
import { validate as uiValidate } from '../validators/uiValidator.js';
import { validate as textValidate } from '../validators/textValidator.js';
import { validate as dataValidate } from '../validators/dataValidator.js';
import { buildValidationResultPlaceholder } from '../validators/resultPlaceholder.js';
import { run as runValidatorEngine } from '../validators/engine.js';

const SidePanel = () => {
  const [steps, setSteps] = useState([]);
  const [mdInput, setMdInput] = useState('');
  const [mdOutput, setMdOutput] = useState('');
  const [promptText, setPromptText] = useState('');
  const [planText, setPlanText] = useState('');
  const [unifiedText, setUnifiedText] = useState('');
  const [validateText, setValidateText] = useState('');
  const [validateJsonCache, setValidateJsonCache] = useState({});
  const [validateResultText, setValidateResultText] = useState('');
  const [execStatus, setExecStatus] = useState('PENDING');
  const [simulateText, setSimulateText] = useState('');
  const [assertTemplateText, setAssertTemplateText] = useState('');
  const [simulateJsonCache, setSimulateJsonCache] = useState({});
  const [assertTemplateCache, setAssertTemplateCache] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [fileStatus, setFileStatus] = useState('');

  const defaultSettings = {
    enabled: true,
    events: { click: true, input: true, change: true, scroll: false },
    debounceMs: 300,
    throttleMs: 500,
    networkCapture: false
  };
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    // 1. Load initial state from storage
    chrome.storage.local.get(['recorded_steps', 'settings'], (result) => {
      if (result.recorded_steps && Array.isArray(result.recorded_steps)) {
        setSteps(result.recorded_steps);
      }
      if (result.settings) {
        setSettings({ ...defaultSettings, ...result.settings });
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

  const saveSettings = (next) => {
    setSettings(next);
    chrome.storage.local.set({ settings: next });
  };

  return (
    <div style={{ padding: '16px', fontFamily: 'sans-serif' }}>
      <h2>录制配置</h2>
      <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => saveSettings({ ...settings, enabled: e.target.checked })}
          />
          启用录制
        </label>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {['click', 'input', 'change', 'scroll'].map((k) => (
            <label key={k} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={settings.events?.[k]}
                onChange={(e) =>
                  saveSettings({
                    ...settings,
                    events: { ...settings.events, [k]: e.target.checked }
                  })
                }
              />
              {k}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label>
            防抖(ms)：
            <input
              type="number"
              value={settings.debounceMs}
              style={{ width: '80px', marginLeft: '6px' }}
              onChange={(e) =>
                saveSettings({ ...settings, debounceMs: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label>
            节流(ms)：
            <input
              type="number"
              value={settings.throttleMs}
              style={{ width: '80px', marginLeft: '6px' }}
              onChange={(e) =>
                saveSettings({ ...settings, throttleMs: Number(e.target.value) || 0 })
              }
            />
          </label>
        </div>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={settings.networkCapture}
            onChange={(e) => saveSettings({ ...settings, networkCapture: e.target.checked })}
          />
          网络采集
        </label>
      </div>

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
      <div style={{ margin: '8px 0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const parsed = parseMarkdown(mdInput || '')
            setMdOutput(JSON.stringify(parsed, null, 2))
          }}
        >
          解析
        </button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="file"
            accept=".md,text/markdown"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                const text = String(reader.result || '')
                setMdInput(text)
                const parsed = parseMarkdown(text)
                setMdOutput(JSON.stringify(parsed, null, 2))
                setFileStatus('已导入 Markdown')
              }
              reader.onerror = () => setFileStatus('导入失败')
              reader.readAsText(file)
            }}
          />
          导入 Markdown
        </label>
        <span style={{ fontSize: '12px', color: '#666' }}>{fileStatus}</span>
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

      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const exec = executePlan(steps)
            setSimulateJsonCache(exec)
            setSimulateText(JSON.stringify(exec, null, 2))
          }}
        >
          执行模拟
        </button>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const data = JSON.stringify(steps, null, 2)
            const blob = new Blob([data], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'steps.json'
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          导出 Steps
        </button>
      </div>
      <textarea
        value={simulateText}
        readOnly
        rows={6}
        style={{
          width: '100%',
          fontSize: '12px',
          padding: '8px',
          boxSizing: 'border-box',
          marginTop: '8px'
        }}
        placeholder="执行模拟日志将显示在这里..."
      />

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
            const template = generateAssertionTemplate(docJson)
            setAssertTemplateCache(template)
            setAssertTemplateText(template)
          }}
        >
          生成断言模板
        </button>
      </div>
      <textarea
        value={assertTemplateText}
        readOnly
        rows={6}
        style={{
          width: '100%',
          fontSize: '12px',
          padding: '8px',
          boxSizing: 'border-box',
          marginTop: '8px'
        }}
        placeholder="断言模板将显示在这里..."
      />

      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
            const exec = executePlan(steps)
            const assertsPlan = {
              ui: uiValidate({ steps }),
              text: textValidate({ steps }),
              data: dataValidate({ steps })
            }
            const template = generateAssertionTemplate(docJson)
            setPromptText(prompt)
            setPlanText(JSON.stringify({ executor: exec, assertions: assertPlan({ steps }) }, null, 2))
            setValidateJsonCache(assertsPlan)
            setValidateText(JSON.stringify(assertsPlan, null, 2))
            setSimulateJsonCache(exec)
            setSimulateText(JSON.stringify(exec, null, 2))
            setAssertTemplateCache(template)
            setAssertTemplateText(template)

            const unified = assembleUnifiedOutput({
              promptText: prompt,
              planJson: { executor: exec, assertions: assertPlan({ steps }) },
              validateJson: assertsPlan || {},
              simulateJson: exec || {},
              assertionTemplate: template || ''
            })
            setUnifiedText(unified)
          }}
        >
          一键生成全流程
        </button>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            let planJson = {}
            try {
              planJson = planText ? JSON.parse(planText) : {}
            } catch (e) {
              planJson = {}
            }
            const unified = assembleUnifiedOutput({
              promptText,
              planJson,
              validateJson: validateJsonCache || {},
              simulateJson: simulateJsonCache || {},
              assertionTemplate: assertTemplateCache || ''
            })
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
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(unifiedText || '')
              setCopyStatus('复制成功')
            } catch (e) {
              setCopyStatus('复制失败')
            }
          }}
        >
          复制统一输出
        </button>
        <span style={{ fontSize: '12px', color: '#666' }}>{copyStatus}</span>
      </div>

      <div style={{ marginTop: '12px' }}>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const ctx = { steps }
            const plan = {
              ui: uiValidate(ctx),
              text: textValidate(ctx),
              data: dataValidate(ctx)
            }
            setValidateJsonCache(plan)
            setValidateText(JSON.stringify(plan, null, 2))
          }}
        >
          生成校验计划
        </button>
      </div>
      <textarea
        value={validateText}
        readOnly
        rows={6}
        style={{
          width: '100%',
          fontSize: '12px',
          padding: '8px',
          boxSizing: 'border-box',
          marginTop: '8px'
        }}
        placeholder="校验计划将显示在这里..."
      />

      <div style={{ marginTop: '12px' }}>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const result = buildValidationResultPlaceholder()
            setValidateResultText(JSON.stringify(result, null, 2))
          }}
        >
          生成校验结果占位
        </button>
      </div>
      <textarea
        value={validateResultText}
        readOnly
        rows={6}
        style={{
          width: '100%',
          fontSize: '12px',
          padding: '8px',
          boxSizing: 'border-box',
          marginTop: '8px'
        }}
        placeholder="校验结果占位将显示在这里..."
      />

      <div style={{ marginTop: '12px' }}>
        <button
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            setExecStatus('RUNNING')
            const engine = runValidatorEngine({ steps })
            const status = engine?.result?.status || 'DONE'
            setExecStatus(status)
          }}
        >
          执行状态占位
        </button>
        <div style={{ marginTop: '6px', fontSize: '12px', color: '#333' }}>
          执行状态: {execStatus}
        </div>
      </div>
    </div>
  );
};

export default SidePanel;
