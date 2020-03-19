import React from 'react'
import * as R from 'ramda'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import * as yup from 'yup'

import './App.css'

const MessageBox = ({ children }) => (
  <div className="messagebox">{children}</div>
)

const GameTime = ({ started, stopped }) => {
  const [, refresh] = React.useState(0)
  React.useEffect(() => {
    if (!started || stopped) return
    const tid = setInterval(() => refresh(x => x + 1), 1000)
    return () => clearInterval(tid)
  }, [started, stopped])

  return (
    <span>
      Time: {started ? ((stopped || Date.now()) - started) / 1000 : '-'}
    </span>
  )
}

const Log = p => (console.log(p), null)

export default () => {
  console.log('render')

  const [gameOptions, setGameOptions] = React.useState(DEFAULT_GAME_OPTIONS)
  const game = useGame()

  React.useEffect(() => game.reset(gameOptions), [gameOptions])

  return (
    <div>
      <Formik
        initialValues={DEFAULT_GAME_OPTIONS}
        validationSchema={yup.object({
          rows: yup
            .number()
            .required()
            .min(10)
            .max(30),
          cols: yup
            .number()
            .required()
            .min(10)
            .max(30),
          mines: yup
            .number()
            .required()
            .min(10)
            .max(100)
            .test('mines', 'Too much mines', function() {
              const { mines, rows, cols } = this.parent
              return mines / (rows * cols) < 0.3
            }),
        })}
        onSubmit={values => setGameOptions(values)}
      >
        {({ isValid, values }) => {
          React.useEffect(() => {
            isValid && setGameOptions(values)
          })
          return (
            <Form>
              <div>
                <label>
                  Rows:
                  <Field name="rows" type="number" />
                </label>
                <ErrorMessage name="rows" component="div" />
              </div>

              <div>
                <label>
                  Cols:
                  <Field name="cols" type="number" />
                </label>
                <ErrorMessage name="cols" component="div" />
              </div>

              <div>
                <label>
                  Mines:
                  <Field name="mines" type="number" />
                </label>
                <ErrorMessage name="mines" component="div" />
              </div>

              <button type="submit">New game!</button>
            </Form>
          )
        }}
      </Formik>

      <GameTime started={game.started} stopped={game.stopped} />
      <span>Mines: {game.minesLeft}</span>
      <hr />

      <div className="container">
        <table onContextMenu={ev => ev.preventDefault()}>
          <tbody>
            {game.field.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`cell-${cell}`}
                    onClick={() => game.open(ri, ci)}
                    onContextMenu={() => game.mark(ri, ci)}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {typeof game.won === 'boolean' && (
        <MessageBox>{game.won ? 'You win!' : 'You lose!'}</MessageBox>
      )}
    </div>
  )
}

function useGame() {
  const [state, dispatch] = React.useReducer(gameReducer, undefined, resetGame)
  return {
    ...state,
    reset: options => dispatch({ type: 'reset', payload: options }),
    open: (row, col) => dispatch({ type: 'open', payload: { row, col } }),
    mark: (row, col) => dispatch({ type: 'mark', payload: { row, col } }),
    revealAll: () => dispatch({ type: 'revealAll' }),
  }
}

function gameReducer(state, action) {
  switch (action.type) {
    case 'reset':
      return resetGame(action.payload)
    case 'open':
      return openCell(state, action.payload)
    case 'mark':
      return markCell(state, action.payload)
    case 'revealAll':
      return revealAll(state)
    default:
      return state
  }
}

const DEFAULT_GAME_OPTIONS = { rows: 10, cols: 10, mines: 10 }

const resetGame = ({ rows, cols, mines } = DEFAULT_GAME_OPTIONS) => {
  const state = {
    options: { rows, cols, mines },
    started: null,
    stopped: null,
    minesLeft: mines,
    _cellsLeft: rows * cols - mines,
  }

  state._values = R.range(0, rows).map(() => R.range(0, cols).fill(0))
  placeMines(state._values, state.options)
  state.field = state._values.map(row => row.map(() => 'closed'))

  return state
}

const openCell = (state, { row, col }) => {
  const cellState = state.field[row][col]
  if (cellState !== 'closed' && cellState !== 'question') return state

  const value = state._values[row][col]

  let newState = R.mergeRight(state, {
    field: R.adjust(row, R.update(col, value), state.field),
    started: state.started || Date.now(), // not so FP, but quick
    _cellsLeft: state._cellsLeft - 1,
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
      })
    ),
  })
}

function placeMines(field, { rows, cols, mines }) {
  while (mines) {
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)

    if (!field[r][c]) {
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

// var d = {
//   number(initial) {
//     return {
//       type: 'number',
//       initial() {
//         return initial
//       },
//       validate(x) {
//         return typeof x === 'number' ? undefined : `"${x}" is not a number.`
//       },
//       cast() {
//         return x => (isNaN(x) ? x : Number(x))
//       },
//     }
//   },
// }

// function field(dr) {
//   return my.changeable({
//     descriptor: dr,
//     raw: dr.initial(),
//     get error() {
//       return dr.validate(dr.cast()(this.raw))
//     },
//     get isValid() {
//       return !this.error
//     },
//     get value() {
//       const e = this.error
//       if (e) throw e
//       else return dr.cast()(this.raw)
//     },
//     set value(x) {
//       this.raw = x
//     },
//     touched: false,
//   })
// }

// function form(drs, validate) {
//   const fields = my.objectMap(drs, field)

//   const changed = my.signal()
//   Object.values(fields).forEach(x =>
//     x.changed.subscribe(changed.next.bind(changed))
//   )

//   const valueChanged = my.signal() // TODO move to field
//   const prevValues = {}
//   Object.keys(fields).forEach(k =>
//     fields[k].changed.subscribe(() => {
//       if (fields[k].isValid && fields[k].value !== prevValues[k]) {
//         prevValues[k] = fields[k].value
//         valueChanged.next(k)
//       }
//     })
//   )

//   return {
//     changed,
//     valueChanged,
//     fields,
//     get errors() {
//       return my.objectMap(fields, x => x.error)
//     },
//     get values() {
//       return my.objectMap(fields, x => x.value)
//     },
//     get isValid() {
//       return Object.values(fields).every(x => x.isValid)
//     },
//   }
// }
