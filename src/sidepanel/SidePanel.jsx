import { useEffect, useState } from 'react'

export default function SidePanel() {
  const [steps, setSteps] = useState([])

  useEffect(() => {
    const handler = (message) => {
      if (!message || message.type !== 'recording-step') return
      if (!message.step) return
      setSteps((prev) => [...prev, message.step])
    }

    chrome.runtime.onMessage.addListener(handler)

    return () => {
      chrome.runtime.onMessage.removeListener(handler)
    }
  }, [])

  return (
    <div className="sidepanel">
      <header className="sidepanel__header">
        <h1>Recorded Steps</h1>
        <p>{steps.length} steps</p>
      </header>
      <ol className="sidepanel__list">
        {steps.map((step, index) => (
          <li key={`${step.timestamp}-${index}`} className="sidepanel__item">
            <div className="sidepanel__action">{step.action}</div>
            <div className="sidepanel__details">
              <div className="sidepanel__xpath">{step.xpath}</div>
              {step.action === 'input' ? (
                <div className="sidepanel__value">Value: {step.value}</div>
              ) : null}
              {step.text ? (
                <div className="sidepanel__text">Text: {step.text}</div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
