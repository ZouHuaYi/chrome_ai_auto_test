import React, { useState, useEffect } from 'react';
import { parseMarkdown } from '../parser/markdown.js';
import { parseMindmap } from '../parser/mindmap.js';
import { getDocIdFromInput, fetchDoc, fetchPublicDoc } from '../feishu.js';
import { assemblePrompt } from '../prompt/assembler.js';
import { assembleUnifiedOutput } from '../prompt/unified.js';
import { executePlan } from '../executor/executor.js';
import { assertPlan } from '../assertions/assertor.js';
import { generateAssertionTemplate } from '../assertions/template.js';
import { validate as uiValidate } from '../validators/uiValidator.js';
import { validate as textValidate } from '../validators/textValidator.js';
import { validate as dataValidate } from '../validators/dataValidator.js';
import { buildValidationResultPlaceholder } from '../validators/resultPlaceholder.js';
import { diffReports, formatReportMarkdown } from '../report/report.js';

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
  const [execReport, setExecReport] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [simulateText, setSimulateText] = useState('');
  const [assertTemplateText, setAssertTemplateText] = useState('');
  const [simulateJsonCache, setSimulateJsonCache] = useState({});
  const [assertTemplateCache, setAssertTemplateCache] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [fileStatus, setFileStatus] = useState('');
  const [assertionResult, setAssertionResult] = useState(null);
  const [exportHistory, setExportHistory] = useState([]);
  const [exportHistoryCopyStatus, setExportHistoryCopyStatus] = useState('');
  const EXPORT_HISTORY_MAX = 20;

  const defaultModelConfig = { model: 'gpt-4o', temperature: 0.2, max_tokens: 2048 };
  const defaultLlmSettings = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    timeoutMs: 30000,
    retry: 2,
    retryBaseMs: 500,
    retryMaxMs: 8000,
    rateLimitPerMin: 60
  };
  const [modelConfig, setModelConfig] = useState(defaultModelConfig);
  const [llmSettings, setLlmSettings] = useState(defaultLlmSettings);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmResult, setLlmResult] = useState('');
  const [llmError, setLlmError] = useState('');
  const [feishuText, setFeishuText] = useState('');
  const [feishuDocTokenOrUrl, setFeishuDocTokenOrUrl] = useState('');
  const [feishuDocJson, setFeishuDocJson] = useState(null);
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [feishuError, setFeishuError] = useState('');
  const [mindmapText, setMindmapText] = useState('');
  const [mindmapDocJson, setMindmapDocJson] = useState(null);
  const [mindmapParseError, setMindmapParseError] = useState('');
  const [docSource, setDocSource] = useState('md'); // 'md' | 'feishu' | 'mindmap'
  const [importStatus, setImportStatus] = useState('');
  const defaultFeishuConfig = { accessToken: '', apiBase: 'https://open.feishu.cn/open-apis' };
  const [feishuConfig, setFeishuConfig] = useState(defaultFeishuConfig);
  const [stepsImportMode, setStepsImportMode] = useState('replace'); // 'replace' | 'append'
  const [stepsImportDedup, setStepsImportDedup] = useState(false);
  const [stepsImportStatus, setStepsImportStatus] = useState('');
  const [replayOptions, setReplayOptions] = useState({
    captureScreenshots: false,
    captureOnFailure: true
  });
  const [lastRunResult, setLastRunResult] = useState(null);

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
    chrome.storage.local.get(['recorded_steps', 'settings', 'modelConfig', 'feishuConfig', 'exportHistory', 'llmSettings'], (result) => {
      if (result.recorded_steps && Array.isArray(result.recorded_steps)) {
        setSteps(result.recorded_steps);
      }
      if (result.settings) {
        setSettings({ ...defaultSettings, ...result.settings });
      }
      if (result.modelConfig) {
        setModelConfig({ ...defaultModelConfig, ...result.modelConfig });
      }
      if (result.llmSettings) {
        setLlmSettings({ ...defaultLlmSettings, ...result.llmSettings });
      }
      if (result.feishuConfig) {
        setFeishuConfig({ ...defaultFeishuConfig, ...result.feishuConfig });
      }
      if (result.exportHistory && Array.isArray(result.exportHistory)) {
        setExportHistory(result.exportHistory);
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

  const saveModelConfig = (next) => {
    setModelConfig(next);
    chrome.storage.local.set({ modelConfig: next });
  };

  const saveLlmSettings = (next) => {
    setLlmSettings(next);
    chrome.storage.local.set({ llmSettings: next });
  };

  const saveFeishuConfig = (next) => {
    setFeishuConfig(next);
    chrome.storage.local.set({ feishuConfig: next });
  };

  /** 当前用于生成的文档结构：MD / 飞书 / 思维导图 三选一，始终返回 { type, children } 形状 */
  const getEffectiveDocJson = () => {
    if (docSource === 'feishu' && feishuDocJson) return feishuDocJson;
    if (docSource === 'mindmap' && mindmapDocJson) return mindmapDocJson;
    try {
      const out = mdOutput ? JSON.parse(mdOutput) : parseMarkdown(mdInput || '');
      return out && typeof out === 'object' ? out : { type: 'document', children: [] };
    } catch {
      return parseMarkdown(mdInput || '');
    }
  };

  /** 同 target 同 type 的连续步骤合并为一条（保留第一条） */
  const dedupSteps = (stepList) => {
    if (!Array.isArray(stepList) || stepList.length === 0) return stepList;
    const out = [];
    for (const s of stepList) {
      const key = `${s.type ?? ''}\0${s.target ?? ''}`;
      if (out.length === 0 || `${out[out.length - 1].type}\0${out[out.length - 1].target}` !== key) {
        out.push(s);
      }
    }
    return out;
  };

  const applyReplayResult = (res) => {
    setExecReport(res.report)
    setValidationResult(res.validationResult)
    setAssertionResult(res.assertionResult)
    setLastRunResult(res.result || null)
    setExecStatus(res.ok ? 'DONE' : 'FAIL')
  };

  const buildBaiduSampleSteps = () => {
    const url = 'https://www.baidu.com/';
    return [
      {
        type: 'click',
        target: '#kw',
        selector: { css: '#kw', xpath: '//*[@id="kw"]' },
        tag: 'input',
        text: '',
        timestamp: Date.now(),
        url
      },
      {
        type: 'input',
        target: '#kw',
        selector: { css: '#kw', xpath: '//*[@id="kw"]' },
        tag: 'input',
        value: 'OpenAI',
        timestamp: Date.now(),
        url
      },
      {
        type: 'click',
        target: '#su',
        selector: { css: '#su', xpath: '//*[@id="su"]' },
        tag: 'input',
        text: '????',
        timestamp: Date.now(),
        url
      }
    ];
  };

  const waitForTabComplete = (tabId, timeoutMs = 15000) => new Promise((resolve) => {
    const start = Date.now();
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(true);
      }
      if (Date.now() - start > timeoutMs) {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(false);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  const getLastReportFromHistory = (history) => {
    const list = Array.isArray(history) ? history : [];
    return list.find((item) => item.kind === 'report' && item.report) || null;
  };

  const exportReport = (format) => {
    if (!lastRunResult) {
      setExportHistoryCopyStatus('No report to export');
      return;
    }
    const ts = new Date();
    const diff = diffReports(getLastReportFromHistory(exportHistory)?.report, lastRunResult);
    const payload = { report: lastRunResult, diff, exportedAt: ts.toISOString() };
    const content = format === 'json'
      ? JSON.stringify(payload, null, 2)
      : formatReportMarkdown(lastRunResult, diff);

    const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`;
    const filename = `report_${stamp}.${format === 'json' ? 'json' : 'md'}`;
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    const next = [
      { id: Date.now(), timestamp: ts.toISOString(), content, kind: 'report', format, report: lastRunResult, diff },
      ...exportHistory
    ].slice(0, EXPORT_HISTORY_MAX);
    setExportHistory(next);
    chrome.storage.local.set({ exportHistory: next });
  };

  const runBaiduSample = async () => {
    const sample = buildBaiduSampleSteps();
    setSteps(sample);
    chrome.storage.local.set({ recorded_steps: sample });
    setExecStatus('RUNNING');
    setExecReport(null);
    setValidationResult(null);
    setAssertionResult(null);
    setLastRunResult(null);
    const tab = await chrome.tabs.create({ url: 'https://www.baidu.com/' });
    if (tab?.id) {
      await waitForTabComplete(tab.id);
      const res = await executePlan(sample, tab.id, { ...replayOptions, assertionTemplate: assertTemplateCache || "" });
      applyReplayResult(res);
    } else {
      setExecStatus('FAIL');
    }
  };

  const runLlm = async () => {
    const prompt = promptText || '';
    if (!prompt.trim()) {
      setLlmError('Prompt 为空，无法调用 LLM');
      return;
    }
    setLlmLoading(true);
    setLlmError('');
    setLlmResult('');
    try {
      chrome.runtime.sendMessage({ action: 'LLM_CALL', prompt }, (res) => {
        if (!res) {
          setLlmError('LLM 无响应');
          setLlmLoading(false);
          return;
        }
        if (!res.ok) {
          setLlmError(`${res.error?.type || 'error'}: ${res.error?.message || 'Unknown error'}`);
          setLlmLoading(false);
          return;
        }
        setLlmResult(res.content || '');
        setLlmLoading(false);
      });
    } catch (e) {
      setLlmError(String(e?.message || e));
      setLlmLoading(false);
    }
  };

  /** 导出统一输出为带时间戳的文件，并写入 exportHistory（最近 N 条） */
  const handleExportUnified = () => {
    let planJson = {};
    try {
      planJson = planText ? JSON.parse(planText) : {};
    } catch {
      planJson = {};
    }
    const content = assembleUnifiedOutput({
      promptText,
      planJson,
      validateJson: validateJsonCache || {},
      simulateJson: simulateJsonCache || {},
      assertionTemplate: assertTemplateCache || '',
      assertionResult: assertionResult ?? undefined,
      modelConfig
    });
    const ts = new Date();
    const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`;
    const filename = `unified_${stamp}.txt`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    const next = [
      { id: Date.now(), timestamp: ts.toISOString(), content, kind: 'unified', format: 'txt' },
      ...exportHistory
    ].slice(0, EXPORT_HISTORY_MAX);
    setExportHistory(next);
    chrome.storage.local.set({ exportHistory: next });
  };

  const handleImportSteps = (file, replace, dedup) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || '');
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : (parsed?.steps && Array.isArray(parsed.steps) ? parsed.steps : []);
        let next = replace ? list : [...steps, ...list];
        if (dedup) next = dedupSteps(next);
        setSteps(next);
        chrome.storage.local.set({ recorded_steps: next }, () => {
          setStepsImportStatus(`已${replace ? '替换' : '追加'}，共 ${next.length} 条${dedup ? '（已去重）' : ''}`);
        });
      } catch (e) {
        setStepsImportStatus('导入失败：非合法 JSON 或格式不符');
      }
    };
    reader.onerror = () => setStepsImportStatus('读取文件失败');
    reader.readAsText(file);
  };

  return (
    <div className="panel-root">
      <style>{`
        .panel-root { font-family: 'Inter', system-ui, -apple-system, Segoe UI, sans-serif; background:#0F172A; color:#F8FAFC; padding:16px; min-height:100vh; }
        .panel-root h2 { margin:0 0 12px; font-size:18px; font-weight:700; color:#F8FAFC; }
        .panel-root h3 { margin:16px 0 8px; font-size:14px; font-weight:600; color:#E2E8F0; }
        .panel-root input, .panel-root textarea, .panel-root select { background:#0B1220; color:#F8FAFC; border:1px solid #334155; border-radius:8px; padding:6px 8px; outline:none; }
        .panel-root input:focus, .panel-root textarea:focus, .panel-root select:focus { border-color:#22C55E; box-shadow:0 0 0 2px rgba(34,197,94,0.2); }
        .panel-root button { background:#334155; color:#F8FAFC; border:1px solid #475569; border-radius:8px; padding:6px 10px; cursor:pointer; transition:background 150ms, border 150ms; }
        .panel-root button:hover { background:#1E293B; border-color:#64748B; }
        .panel-root button:disabled { opacity:0.6; cursor:not-allowed; }
        .panel-root .btn-primary { background:#22C55E; border-color:#22C55E; color:#0B1220; font-weight:600; }
        .panel-root .btn-secondary { background:#1F2937; border-color:#334155; color:#E2E8F0; }
        .panel-root .btn-danger { background:#EF4444; border-color:#EF4444; color:#fff; }
        .panel-root .badge { display:inline-block; padding:2px 6px; border-radius:6px; font-size:11px; margin-left:6px; }
        .panel-root .badge.pass { background:#16A34A; color:#fff; }
        .panel-root .badge.fail { background:#DC2626; color:#fff; }
        .panel-root .card { background:#0B1220; border:1px solid #1F2937; border-radius:12px; padding:12px; margin-bottom:12px; }
        .panel-root details { background:#0B1220; border:1px solid #1F2937; border-radius:10px; padding:6px 8px; }
        .panel-root details summary { cursor:pointer; font-weight:600; color:#E2E8F0; }
        .panel-root details[open] summary { margin-bottom:6px; }
      `}</style>
      <h2>模型配置</h2>
      <div className="card">
        <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
        <label>
          Model：
          <input
            type="text"
            value={modelConfig.model}
            style={{ width: '180px', marginLeft: '6px' }}
            onChange={(e) => saveModelConfig({ ...modelConfig, model: e.target.value })}
          />
        </label>
        <label>
          Temperature：
          <input
            type="number"
            step="0.1"
            value={modelConfig.temperature}
            style={{ width: '80px', marginLeft: '6px' }}
            onChange={(e) =>
              saveModelConfig({ ...modelConfig, temperature: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Max Tokens：
          <input
            type="number"
            value={modelConfig.max_tokens}
            style={{ width: '100px', marginLeft: '6px' }}
            onChange={(e) =>
              saveModelConfig({ ...modelConfig, max_tokens: Number(e.target.value) })
            }
          />
        </label>
        </div>

        <h3 style={{ marginTop: 0 }}>LLM Settings</h3>
        <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
        <label>
          Base URL
          <input
            type="text"
            value={llmSettings.baseUrl}
            style={{ width: '100%', marginLeft: '6px' }}
            onChange={(e) => saveLlmSettings({ ...llmSettings, baseUrl: e.target.value })}
          />
        </label>
        <label>
          API Key
          <input
            type="password"
            value={llmSettings.apiKey}
            style={{ width: '100%', marginLeft: '6px' }}
            onChange={(e) => saveLlmSettings({ ...llmSettings, apiKey: e.target.value })}
          />
        </label>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label>
            Timeout(ms)
            <input
              type="number"
              value={llmSettings.timeoutMs}
              style={{ width: '100px', marginLeft: '6px' }}
              onChange={(e) => saveLlmSettings({ ...llmSettings, timeoutMs: Number(e.target.value) || 0 })}
            />
          </label>
          <label>
            Retry
            <input
              type="number"
              value={llmSettings.retry}
              style={{ width: '80px', marginLeft: '6px' }}
              onChange={(e) => saveLlmSettings({ ...llmSettings, retry: Number(e.target.value) || 0 })}
            />
          </label>
          <label>
            Rate Limit/min
            <input
              type="number"
              value={llmSettings.rateLimitPerMin}
              style={{ width: '100px', marginLeft: '6px' }}
              onChange={(e) => saveLlmSettings({ ...llmSettings, rateLimitPerMin: Number(e.target.value) || 0 })}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            style={{ cursor: 'pointer', padding: '4px 8px' }}
            onClick={runLlm}
            disabled={llmLoading}
          >
            {llmLoading ? 'LLM Calling...' : 'Call LLM'}
          </button>
          <span style={{ fontSize: '12px', color: '#c00' }}>{llmError}</span>
        </div>
        <textarea
          value={llmResult}
          readOnly
          rows={4}
          style={{ width: '100%', fontSize: '12px', padding: '8px', boxSizing: 'border-box' }}
          placeholder="LLM response will appear here..."
        />
      </div>
      </div>

      <div className="card">
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
      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn-danger" onClick={handleClear} style={{ cursor: 'pointer', padding: '4px 8px' }}>清空记录</button>
        <button className="btn-secondary" onClick={runBaiduSample} style={{ cursor: 'pointer', padding: '4px 8px' }}>Baidu Sample</button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportSteps(file, stepsImportMode === 'replace', stepsImportDedup);
              e.target.value = '';
            }}
          />
          导入 Steps
        </label>
        <label style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          <select
            value={stepsImportMode}
            onChange={(e) => setStepsImportMode(e.target.value)}
            style={{ padding: '2px 6px' }}
          >
            <option value="replace">替换</option>
            <option value="append">追加</option>
          </select>
        </label>
        <label style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={stepsImportDedup}
            onChange={(e) => setStepsImportDedup(e.target.checked)}
          />
          去重
        </label>
        <span style={{ fontSize: '12px', color: '#666' }}>{stepsImportStatus}</span>
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {steps.map((step, index) => (
          <li key={index} style={{
            marginBottom: '8px',
            padding: '8px',
            background: step.type === 'network' ? '#e8f4fc' : '#f4f4f4',
            borderRadius: '4px',
            fontSize: '12px',
            wordBreak: 'break-all'
          }}>
            <div style={{ fontWeight: 'bold', color: step.type === 'network' ? '#0a5a8a' : '#333' }}>
              {index + 1}. {String(step.type || 'unknown').toUpperCase()}
            </div>
            {step.type === 'network' ? (
              <div style={{ color: '#666', marginTop: '4px' }}>
                <span style={{ marginRight: '8px' }}><strong>method:</strong> {step.method ?? '—'}</span>
                <span style={{ marginRight: '8px' }}><strong>url:</strong> {step.url ?? step.target ?? '—'}</span>
                <span><strong>status:</strong> {step.statusCode ?? '—'}</span>
              </div>
            ) : (
              <>
                <div style={{ color: '#666', marginTop: '4px' }}>{step.target}</div>
                {step.value != null && <div style={{ color: '#0056b3', marginTop: '2px' }}>值: {step.value}</div>}
                {step.text && <div style={{ color: '#0056b3', marginTop: '2px' }}>文本: {step.text}</div>}
              </>
            )}
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
      <hr style={{ margin: '20px 0' }} />

      <div className="card">
      <h2 style={{ marginTop: 0 }}>Docs Import</h2>
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
          className="btn-secondary"
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const parsed = parseMarkdown(mdInput || '');
            setMdOutput(JSON.stringify(parsed, null, 2));
            setDocSource('md');
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
                const text = String(reader.result || '');
                setMdInput(text);
                const parsed = parseMarkdown(text);
                setMdOutput(JSON.stringify(parsed, null, 2));
                setDocSource('md');
                setFileStatus('已导入 Markdown');
              }
              reader.onerror = () => setFileStatus('导入失败')
              reader.readAsText(file)
            }}
          />
          导入 Markdown
        </label>
        <span style={{ fontSize: '12px', color: '#666' }}>{fileStatus}</span>
      </div>

      <h3 style={{ marginBottom: '8px' }}>飞书文档导入</h3>
      <div style={{ display: 'grid', gap: '8px', marginBottom: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          Access Token：
          <input
            type="password"
            value={feishuConfig.accessToken}
            onChange={(e) => saveFeishuConfig({ ...feishuConfig, accessToken: e.target.value })}
            placeholder="tenant_access_token"
            style={{ flex: 1, fontSize: '12px', padding: '6px' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          API Base（可选）：
          <input
            type="text"
            value={feishuConfig.apiBase}
            onChange={(e) => saveFeishuConfig({ ...feishuConfig, apiBase: e.target.value })}
            placeholder="https://open.feishu.cn/open-apis"
            style={{ flex: 1, fontSize: '12px', padding: '6px' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          文档 Token / 链接：
          <input
            type="text"
            value={feishuDocTokenOrUrl}
            onChange={(e) => { setFeishuDocTokenOrUrl(e.target.value); setFeishuError(''); }}
            placeholder="doccnXXX 或飞书文档 URL"
            style={{ flex: 1, fontSize: '12px', padding: '6px' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn-primary"
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          disabled={feishuLoading}
          onClick={async () => {
            const docId = getDocIdFromInput(feishuDocTokenOrUrl);
            if (!docId) {
              setFeishuError('请输入文档链接或 Doc Token');
              return;
            }
            setFeishuLoading(true);
            setFeishuError('');
            let result = null;
            if (feishuConfig.accessToken) {
              result = await fetchDoc({
                accessToken: feishuConfig.accessToken,
                docId,
                apiBase: feishuConfig.apiBase || undefined
              });
              if (!result.ok) {
                const fallback = await fetchPublicDoc({
                  input: feishuDocTokenOrUrl,
                  apiBase: feishuConfig.apiBase || undefined
                });
                if (fallback.ok) result = fallback;
              }
            } else {
              result = await fetchPublicDoc({
                input: feishuDocTokenOrUrl,
                apiBase: feishuConfig.apiBase || undefined
              });
            }
            setFeishuLoading(false);
            if (result.ok) {
              setFeishuDocJson(result.docJson);
              setDocSource('feishu');
              setFeishuText(result.text ? String(result.text) : JSON.stringify(result.docJson, null, 2));
            } else {
              setFeishuError(result.error || '??????????????????');
            }
          }
        }
        >
          {feishuLoading ? '拉取中…' : '拉取'}
        </button>
        <span style={{ fontSize: '12px', color: '#c00' }}>{feishuError}</span>
      </div>
      <textarea
        value={feishuText}
        onChange={(e) => setFeishuText(e.target.value)}
        placeholder="拉取成功后显示解析结果 JSON，也可手动粘贴..."
        rows={3}
        style={{ width: '100%', fontSize: '12px', padding: '8px', boxSizing: 'border-box' }}
      />

      <h3 style={{ marginBottom: '8px', marginTop: '12px' }}>思维导图导入</h3>
      <textarea
        value={mindmapText}
        onChange={(e) => { setMindmapText(e.target.value); setMindmapParseError(''); }}
        placeholder="粘贴思维导图 JSON（name/title + children）或 Markdown 大纲（- / * 缩进）..."
        rows={4}
        style={{ width: '100%', fontSize: '12px', padding: '8px', boxSizing: 'border-box' }}
      />
      <div style={{ margin: '8px 0', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn-secondary"
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const result = parseMindmap(mindmapText);
            setMindmapParseError('');
            if (result.ok && result.docJson) {
              setMindmapDocJson(result.docJson);
              setDocSource('mindmap');
              setImportStatus('已解析为文档结构');
            } else {
              setMindmapParseError(result.error || '解析失败');
            }
          }}
        >
          解析思维导图
        </button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="file"
            accept=".json,.md,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const text = String(reader.result || '');
                setMindmapText(text);
                setImportStatus('已导入文件');
              };
              reader.onerror = () => setImportStatus('导入失败');
              reader.readAsText(file);
            }}
          />
          导入文件
        </label>
        <span style={{ fontSize: '12px', color: '#666' }}>{importStatus}</span>
        <span style={{ fontSize: '12px', color: '#c00' }}>{mindmapParseError}</span>
      </div>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
        当前文档来源：{docSource === 'md' ? 'Markdown' : docSource === 'feishu' ? '飞书' : '思维导图'}
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
        {docSource === 'md' ? (mdOutput || '解析结果将显示在这里...') : docSource === 'feishu' ? (feishuText || '拉取飞书后显示') : (mindmapDocJson ? JSON.stringify(mindmapDocJson, null, 2) : '解析思维导图后显示')}
      </pre>
      </div>

      <div className="card">
      <h2 style={{ marginTop: 0 }}>Generate & Run</h2>

      <div style={{ marginTop: '12px' }}>
        <button
          className="btn-primary"
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const docJson = getEffectiveDocJson()
            const prompt = assemblePrompt({ steps, docJson, modelConfig })
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
          className="btn-secondary"
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
          className="btn-secondary"
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
          className="btn-secondary"
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
          className="btn-secondary"
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const docJson = getEffectiveDocJson()
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
          className="btn-primary"
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => {
            const docJson = getEffectiveDocJson()
            const prompt = assemblePrompt({ steps, docJson, modelConfig })
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
              assertionTemplate: template || '',
              modelConfig
            })
            setUnifiedText(unified)
          }}
        >
          一键生成全流程
        </button>
        <button
          className="btn-secondary"
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
              assertionTemplate: assertTemplateCache || '',
              assertionResult: assertionResult ?? undefined,
              modelConfig
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
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          className="btn-secondary"
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
        <button className="btn-secondary" style={{ cursor: 'pointer', padding: '4px 8px' }} onClick={handleExportUnified}>
          导出为文件
        </button>
        <span style={{ fontSize: '12px', color: '#666' }}>{copyStatus}</span>
      </div>

      <div className="card">
      <h2 style={{ marginTop: 0 }}>Reports</h2>
      <h3 style={{ marginTop: '16px', marginBottom: '8px' }}>导出历史（最近 {EXPORT_HISTORY_MAX} 条）</h3>
      <div style={{ marginBottom: '12px', fontSize: '12px', color: '#666' }}>
        导出记录保存在 storage，可点击「复制」再次复制该次导出的内容。
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {exportHistory.length === 0 ? (
          <li style={{ padding: '8px', color: '#999' }}>暂无导出记录</li>
        ) : (
          exportHistory.map((item) => (
            <li
              key={item.id}
              style={{
                padding: '8px 10px',
                marginBottom: '6px',
                background: '#f8f8f8',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '12px', color: '#333' }}>
                {item.timestamp ? new Date(item.timestamp).toLocaleString('zh-CN') : 'N/A'}
                {item.kind ? ` (${item.kind}${item.format ? `:${item.format}` : ''})` : ''}
              </span>
              <button
                className="btn-secondary"
                style={{ cursor: 'pointer', padding: '2px 8px', fontSize: '12px' }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(item.content || '');
                    setExportHistoryCopyStatus(`已复制 (${new Date(item.timestamp).toLocaleTimeString('zh-CN')})`);
                    setTimeout(() => setExportHistoryCopyStatus(''), 2000);
                  } catch (e) {
                    setExportHistoryCopyStatus('复制失败');
                  }
                }}
              >
                复制
              </button>
            </li>
          ))
        )}
      </ul>
      {exportHistoryCopyStatus && (
        <span style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'block' }}>{exportHistoryCopyStatus}</span>
      )}

      </div>
      <div style={{ marginTop: '12px' }}>
        <button
          className="btn-secondary"
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
          className="btn-secondary"
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

      <h3 style={{ marginTop: '16px', marginBottom: '8px' }}>真实执行与校验</h3>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
        在目标网页激活时点击「真实执行」，将在当前标签页回放步骤并执行 ui/text/data 校验。
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={replayOptions.captureScreenshots}
            onChange={(e) => setReplayOptions({ ...replayOptions, captureScreenshots: e.target.checked })}
          />
          Capture Screenshots
        </label>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={replayOptions.captureOnFailure}
            onChange={(e) => setReplayOptions({ ...replayOptions, captureOnFailure: e.target.checked })}
          />
          Only On Failure
        </label>
        <button
          className="btn-secondary"
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => exportReport('json')}
        >
          Export Report JSON
        </button>
        <button
          className="btn-secondary"
          style={{ cursor: 'pointer', padding: '4px 8px' }}
          onClick={() => exportReport('markdown')}
        >
          Export Report Markdown
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

        <button
          className="btn-primary"
          style={{ cursor: 'pointer', padding: '6px 12px' }}
          onClick={async () => {
            setExecStatus('RUNNING')
            setExecReport(null)
            setValidationResult(null)
            setAssertionResult(null)
            setLastRunResult(null)
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [])
            const res = await executePlan(steps, tab?.id, { ...replayOptions, assertionTemplate: assertTemplateCache || "" })
            applyReplayResult(res)

          }}
        >
          真实执行
        </button>
      </div>
      <div style={{ marginTop: '12px', fontSize: '12px' }}>
        <div style={{ marginBottom: '6px' }}>
          <strong>执行状态：</strong>
          <span style={{ color: execStatus === 'FAIL' ? '#c00' : execStatus === 'RUNNING' ? '#08c' : '#333' }}>
            {execStatus === 'RUNNING' ? '执行中…' : execStatus === 'DONE' ? '完成' : execStatus === 'FAIL' ? '失败' : '未执行'}
          </span>
          {execStatus === 'DONE' && <span className="badge pass">PASS</span>}
          {execStatus === 'FAIL' && <span className="badge fail">FAIL</span>}
        </div>
        {execReport?.logs?.length > 0 && (
          <details style={{ marginTop: '8px' }}>
            <summary>Execution Logs ({execReport.logs.length})</summary>
            <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0' }}>
              {execReport.logs.map((log, i) => (
                <li key={i} style={{ padding: '4px 0', borderBottom: '1px solid #eee', color: log.status === 'OK' ? '#080' : log.status === 'FAIL' ? '#c00' : '#666' }}>
                  {log.index}. <span className={`badge ${log.status === 'OK' ? 'pass' : log.status === 'FAIL' ? 'fail' : ''}`}>{log.status}</span> {log.note ? ` note: ${log.note}` : ''} {log.screenshotId ? ` [${log.screenshotId}]` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
        {validationResult && (
          <div style={{ marginTop: '12px' }}>
            <strong>校验结果：</strong>
            <span style={{ color: validationResult.status === 'PASS' ? '#080' : '#c00' }}>{validationResult.status}</span>
            <span className={`badge ${validationResult.status === 'PASS' ? 'pass' : 'fail'}`}>{validationResult.status}</span>
            {validationResult.issues?.length > 0 && (
              <details style={{ marginTop: '6px' }}>
                <summary>Issues ({validationResult.issues.length})</summary>
                <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                  {validationResult.issues.map((issue, i) => (
                    <li key={i} style={{ padding: '4px 0', fontSize: '11px', color: '#c00' }}>
                      [{issue.source || issue.kind}] {issue.message} {issue.selector ? ` selector: ${issue.selector}` : ''} {issue.expected ? ` expected: ${issue.expected}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        {assertionResult != null && (
          <details
            style={{ marginTop: '12px', padding: '10px', background: assertionResult.ok ? '#f0f8f0' : '#fff0f0', borderRadius: '4px', border: `1px solid ${assertionResult.ok ? '#b0d0b0' : '#e0b0b0'}` }}
            open={assertionResult.ok === false}
          >
            <summary style={{ fontWeight: 600 }}>
              ??????????????????????
              <span style={{ color: assertionResult.ok ? '#080' : '#c00', marginLeft: '6px' }}>
                {assertionResult.ok ? 'PASS' : 'FAIL'}
              </span>
              <span className={`badge ${assertionResult.ok ? 'pass' : 'fail'}`}>{assertionResult.ok ? 'PASS' : 'FAIL'}</span>
            </summary>
            {assertionResult.issues?.length > 0 ? (
              <details style={{ marginTop: '8px' }}>
                <summary>Issues ({assertionResult.issues.length})</summary>
                <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {assertionResult.issues.map((issue, i) => (
                  <li key={i} style={{ padding: '6px 0', fontSize: '12px', borderBottom: '1px solid #eee' }}>
                    <span style={{ color: issue.passed ? '#080' : '#c00' }}>{issue.passed ? '???? : '????}</span>
                    {' '}
                    <strong>?????????????/strong>{issue.expected}
                    {' | '}
                    <strong>?????????????/strong>{issue.actual}
                    {issue.reason && <span style={{ color: '#666' }}> | {issue.reason}</span>}
                  </li>
                ))}
                </ul>
              </details>
            ) : (
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#666' }}>?????????????????????????????????????????????????/div>
            )}
          </details>
        )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default SidePanel;
