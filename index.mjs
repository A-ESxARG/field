export const PERSONA_PHASES = ['rut', 'emerging', 'growing', 'taste']

const DEFAULT_PHASE = 'rut'
const DEFAULT_ENERGY = 0.5
const DEFAULT_PLASTICITY = 0.5
const DEFAULT_LABEL = 'default'
const DEFAULT_SEED = 0
const DELAY_BASE = 0.1
const DELAY_ENERGY_SCALE = 0.6
const FEEDBACK_BASE = 0.1
const FEEDBACK_PLASTICITY_SCALE = 0.7
const DRIVE_BASE = 0.2
const DRIVE_ENERGY_SCALE = 0.8
const REFINEMENT_BASE = 0.2
const REFINEMENT_PLASTICITY_SCALE = 0.7
const COUPLING_BASE = 0.2
const COUPLING_ENERGY_PLASTICITY_SCALE = 0.6
const BAND_LOW_THRESHOLD = 0.3
const BAND_HIGH_THRESHOLD = 0.7
const TENSION_RUT = 0.2
const TENSION_EMERGING = 0.5
const TENSION_GROWING = 0.7
const TENSION_TASTE = 0.9
const TENSION_FALLBACK = 0.5
const BURST_ENERGY_DELTA = 0.15
const BURST_PLASTICITY_DELTA = 0.05
const BURST_PHASE_ADVANCE_THRESHOLD = 0.6
const SILENCE_ENERGY_DELTA = -0.1
const SILENCE_PLASTICITY_DELTA = -0.02
const SILENCE_PHASE_REGRESS_THRESHOLD = 0.4
const ENTROPY_ENERGY_SCALE = 0.05
const PLASTICITY_LEARNING_RATE = 0.1

function clamp01(x) { return Math.max(0, Math.min(1, x)) }

export function createFieldState(overrides = {}) {
  const base = {
    persona: {
      phase: DEFAULT_PHASE,
      energy: DEFAULT_ENERGY,
      plasticity: DEFAULT_PLASTICITY
    },
    meta: {
      label: DEFAULT_LABEL,
      notes: '',
      seed: DEFAULT_SEED,
      lastSignalType: null,
      lastEntropy: null
    }
  }
  return mergeFieldState(base, overrides)
}

export function initFieldState(seed = DEFAULT_SEED) {
  return createFieldState({ meta: { label: 'receiver', seed } })
}

export function mergeFieldState(state, partial) {
  return {
    ...state,
    ...partial,
    persona: { ...state.persona, ...(partial.persona || {}) },
    meta: { ...state.meta, ...(partial.meta || {}) }
  }
}

export function fieldToWavePreset(fieldState) {
  const { phase, energy, plasticity } = fieldState.persona
  const phaseIndex = Math.max(0, PERSONA_PHASES.indexOf(phase))
  const delay = DELAY_BASE + energy * DELAY_ENERGY_SCALE
  const entropy = clamp01(plasticity)
  const feedback = FEEDBACK_BASE + plasticity * FEEDBACK_PLASTICITY_SCALE
  const drive = DRIVE_BASE + energy * DRIVE_ENERGY_SCALE
  const refinement = REFINEMENT_BASE + (1 - plasticity) * REFINEMENT_PLASTICITY_SCALE
  const coupling = COUPLING_BASE + energy * plasticity * COUPLING_ENERGY_PLASTICITY_SCALE
  const value = energy
  return { phase, phaseIndex, delay, entropy, feedback, drive, refinement, coupling, value }
}

export function fieldToReceiverMode(fieldState) {
  const { phase, energy, plasticity } = fieldState.persona
  let band = 'mid'
  if (energy < BAND_LOW_THRESHOLD) band = 'low'
  else if (energy > BAND_HIGH_THRESHOLD) band = 'high'
  const noise = clamp01(plasticity)
  const focus = clamp01(1 - plasticity)
  const tension = phase === 'rut' ? TENSION_RUT : phase === 'emerging' ? TENSION_EMERGING : phase === 'growing' ? TENSION_GROWING : phase === 'taste' ? TENSION_TASTE : TENSION_FALLBACK
  return { band, noise, focus, tension, phase, energy, plasticity }
}

export function applySignal(state, signal = {}) {
  const type = signal && signal.type
  if (!type || type === 'noop') return state
  const prevPersona = state.persona
  let { phase, energy, plasticity } = prevPersona
  if (type === 'burst') {
    energy = clamp01(energy + BURST_ENERGY_DELTA)
    plasticity = clamp01(plasticity + BURST_PLASTICITY_DELTA)
    const idx = PERSONA_PHASES.indexOf(phase)
    if (energy > BURST_PHASE_ADVANCE_THRESHOLD && idx >= 0 && idx < PERSONA_PHASES.length - 1) phase = PERSONA_PHASES[idx + 1]
  } else if (type === 'silence') {
    energy = clamp01(energy + SILENCE_ENERGY_DELTA)
    plasticity = clamp01(plasticity + SILENCE_PLASTICITY_DELTA)
    const idx = PERSONA_PHASES.indexOf(phase)
    if (energy < SILENCE_PHASE_REGRESS_THRESHOLD && idx > 0) phase = PERSONA_PHASES[idx - 1]
  } else {
    return state
  }
  return {
    ...state,
    persona: { ...prevPersona, phase, energy, plasticity },
    meta: { ...state.meta, lastSignalType: type }
  }
}

export function applyWaveObservation(state, observation = {}) {
  const prevPersona = state.persona
  let { energy, plasticity, phase } = prevPersona
  const entropy = clamp01(observation && typeof observation.entropy === 'number' ? observation.entropy : 0)
  energy = clamp01(energy + ENTROPY_ENERGY_SCALE * entropy)
  plasticity = clamp01(plasticity + PLASTICITY_LEARNING_RATE * (entropy - plasticity))
  return {
    ...state,
    persona: { ...prevPersona, phase, energy, plasticity },
    meta: { ...state.meta, lastEntropy: entropy }
  }
}