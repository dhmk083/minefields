import * as R from 'ramda'
import { useLogic } from '@dhmk/hooks'

export function useGame() {
  return useLogic(
    () => ({
      reset: options => () => resetGame(options),
      open: (row, col) => state => openCell(state, { row, col }),
      mark: (row, col) => state => markCell(state, { row, col }),
      revealAll: () => revealAll,
    }),
    resetGame,
  )
}

export const DEFAULT_GAME_OPTIONS = { rows: 10, cols: 10, mines: 10 }

const createValues = ({ rows, cols }) =>
  R.range(0, rows).map(() => R.range(0, cols).fill(0))

const resetGame = ({ rows, cols, mines } = DEFAULT_GAME_OPTIONS) => {
  const state = {
    options: { rows, cols, mines },
    started: null,
    stopped: null,
    minesLeft: mines,
    _cellsLeft: rows * cols - mines,
  }

  state._values = createValues(state.options)
  state.field = state._values.map(row => row.map(() => 'closed'))

  return state
}

const openCell = (state, { row, col }) => {
  if (state.stopped) return state

  let { _values } = state
  if (!state.started) {
    _values = createValues(state.options)
    placeMines(_values, state.options, row, col)
  }

  const cellState = state.field[row][col]
  if (cellState !== 'closed' && cellState !== 'question') return state

  const value = _values[row][col]

  let newState = R.mergeRight(state, {
    field: R.adjust(row, R.update(col, value), state.field),
    started: state.started || Date.now(), // not so FP, but quick
    _cellsLeft: state._cellsLeft - 1,
    _values,
  })

  if (value === 0) {
    // optimize this case with mutable temp?
    const { rows, cols } = state.options
    around(row, col, rows, cols, (r, c) => {
      newState = openCell(newState, { row: r, col: c })
    })
  } else if (value === 'mine') {
    newState.won = false
    newState.stopped = Date.now()
  } else if (newState._cellsLeft === 0) {
    newState.won = true
    newState.stopped = Date.now()
  }

  return R.mergeRight(state, newState)
}

const markCell = (state, { row, col }) => {
  if (state.stopped) return state

  const _markCell = cell => {
    switch (cell) {
      case 'closed':
        return 'flag'
      case 'flag':
        return 'question'
      case 'question':
        return 'closed'
      default:
        return cell
    }
  }

  const field = R.adjust(row, R.adjust(col, _markCell), state.field)
  const minesDiff =
    field[row][col] === 'flag' ? -1 : state.field[row][col] === 'flag' ? +1 : 0
  const minesLeft = state.minesLeft + minesDiff

  return R.mergeRight(state, {
    field,
    minesLeft,
  })
}

const revealAll = state => {
  return R.mergeRight(state, {
    field: state.field.map((row, ri) =>
      row.map((cell, ci) => {
        const value = state._values[ri][ci]
        return cell === 'flag' && value !== 'mine' ? 'mine-wrong' : value
      }),
    ),
  })
}

function placeMines(field, { rows, cols, mines }, row, col) {
  while (mines) {
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)

    if (!field[r][c] && r !== row && c !== col) {
      field[r][c] = 'mine'
      mines--

      around(r, c, rows, cols, (r1, c1) => {
        if (typeof field[r1][c1] === 'number') {
          field[r1][c1]++
        }
      })
    }
  }
}

function around(r, c, rows, cols, fn) {
  for (let ri = -1; ri < 2; ri++)
    for (let ci = -1; ci < 2; ci++) {
      const r1 = r + ri
      const c1 = c + ci

      if (
        r1 >= 0 &&
        r1 < rows &&
        c1 >= 0 &&
        c1 < cols &&
        !(r1 === r && c1 === c)
      ) {
        fn(r1, c1)
      }
    }
}
