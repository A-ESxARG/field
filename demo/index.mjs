import { createFieldState, mergeFieldState, fieldToWavePreset } from '../index.mjs'
import { Receiver } from '../node_modules/receiver/index.mjs'

const form = document.getElementById('field-form')
const phaseEl = document.getElementById('phase')
const energyEl = document.getElementById('energy')
const plasticityEl = document.getElementById('plasticity')
const energyValueEl = document.getElementById('energy-value')
const plasticityValueEl = document.getElementById('plasticity-value')
const presetOutput = document.getElementById('preset-output')
const startBtn = document.getElementById('start-btn')
const stopBtn = document.getElementById('stop-btn')
const canvas = document.getElementById('visualizer')
let audioContext = null
let receiver = null
let fieldState = createFieldState()
let rafId = null
let lastTime = null

function clamp01(x) { return Math.max(0, Math.min(1, x)) }

function ensureAudioContext() {
  if (!audioContext) {
    const AC = window.AudioContext || window.webkitAudioContext
    audioContext = new AC()
  }
  return audioContext
}

function updateUrlFromFieldState() {
  const { phase, energy, plasticity } = fieldState.persona
  const url = new URL(window.location.href)
  url.searchParams.set('phase', phase)
  url.searchParams.set('energy', energy.toFixed(2))
  url.searchParams.set('plasticity', plasticity.toFixed(2))
  window.history.replaceState(null, '', url.toString())
}

function applyPersonaToInputs(persona) {
  if (persona.phase) phaseEl.value = persona.phase
  if (typeof persona.energy === 'number') {
    const e = clamp01(persona.energy)
    energyEl.value = String(e)
    energyValueEl.textContent = e.toFixed(2)
  }
  if (typeof persona.plasticity === 'number') {
    const p = clamp01(persona.plasticity)
    plasticityEl.value = String(p)
    plasticityValueEl.textContent = p.toFixed(2)
  }
}

function loadPersonaFromUrl() {
  const url = new URL(window.location.href)
  const phase = url.searchParams.get('phase')
  const energyStr = url.searchParams.get('energy')
  const plasticityStr = url.searchParams.get('plasticity')
  const persona = {}
  if (phase) persona.phase = phase
  if (energyStr != null && energyStr !== '') {
    const e = clamp01(parseFloat(energyStr))
    if (!Number.isNaN(e)) persona.energy = e
  }
  if (plasticityStr != null && plasticityStr !== '') {
    const p = clamp01(parseFloat(plasticityStr))
    if (!Number.isNaN(p)) persona.plasticity = p
  }
  if (Object.keys(persona).length > 0) {
    fieldState = mergeFieldState(fieldState, { persona })
    applyPersonaToInputs(fieldState.persona)
  } else {
    applyPersonaToInputs(fieldState.persona)
  }
}

function updateFieldStateFromUI() {
  const phase = phaseEl.value
  const energy = parseFloat(energyEl.value)
  const plasticity = parseFloat(plasticityEl.value)
  fieldState = mergeFieldState(fieldState, {
    persona: { phase, energy, plasticity }
  })
  const preset = fieldToWavePreset(fieldState)
  energyValueEl.textContent = energy.toFixed(2)
  plasticityValueEl.textContent = plasticity.toFixed(2)
  presetOutput.textContent = JSON.stringify(preset, null, 2)
  updateUrlFromFieldState()
  if (receiver) receiver.setPreset(preset)
}

async function initReceiverIfNeeded() {
  if (receiver) return receiver
  const ctx = ensureAudioContext()
  const preset = fieldToWavePreset(fieldState)
  receiver = new Receiver({
    audioContext: ctx,
    canvas,
    initialPreset: preset,
    name: 'field-demo'
  })
  return receiver
}

function tick(ts) {
  if (!receiver) return
  if (lastTime == null) lastTime = ts
  const dt = (ts - lastTime) / 1000
  lastTime = ts
  receiver.step(dt)
  rafId = requestAnimationFrame(tick)
}

form.addEventListener('input', () => {
  updateFieldStateFromUI()
})

startBtn.addEventListener('click', async () => {
  const r = await initReceiverIfNeeded()
  updateFieldStateFromUI()
  if (audioContext && audioContext.state === 'suspended') await audioContext.resume()
  await r.start()
  if (!rafId) {
    lastTime = null
    rafId = requestAnimationFrame(tick)
  }
})

stopBtn.addEventListener('click', () => {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
    lastTime = null
  }
  if (receiver) receiver.stop()
})

loadPersonaFromUrl()
updateFieldStateFromUI()