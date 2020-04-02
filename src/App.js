import React from 'react'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import * as yup from 'yup'
import * as hooks from '@dhmk/hooks'

import './App.scss'
import { useGame, DEFAULT_GAME_OPTIONS } from './game'

export default () => {
  const [gameOptions, setGameOptions] = React.useState()
  const [game, gameActions] = useGame()
  React.useEffect(() => gameActions.reset(gameOptions), [
    gameOptions,
    gameActions,
  ])

  const [modalOpened, showModal] = React.useState()
  React.useEffect(() => {
    game.stopped && showModal(true)
  }, [game.stopped])
  hooks.useEffectPrevious(
    ([prevModalOpened]) => {
      game.stopped && !modalOpened && prevModalOpened && gameActions.revealAll()
    },
    [modalOpened, game.stopped],
  )

  return (
    <div>
      <GameOptions
        onChange={opts => {
          setGameOptions({ ...opts }) /* trick to force render */
          showModal(false)
        }}
      />
      <hr />

      <div className="wrap-1">
        <div className="wrap-2">
          <div>
            <div className="game-stats">
              <GameTime started={game.started} stopped={game.stopped} />
              <span>Mines: {game.minesLeft}</span>
            </div>

            <div className="game-field">
              <table onContextMenu={ev => ev.preventDefault()}>
                <tbody>
                  {game.field.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`cell-${cell}`}
                          onClick={() => gameActions.open(ri, ci)}
                          onContextMenu={() => gameActions.mark(ri, ci)}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {modalOpened && (
        <MessageBox onClose={() => showModal(false)}>
          {game.won ? 'You win!' : 'You lose!'}
        </MessageBox>
      )}
    </div>
  )
}

const MessageBox = ({ children, onClose }) => (
  <div className="messagebox">
    <div className="messagebox__content">{children}</div>
    <div className="messagebox__footer">
      <button onClick={onClose}>OK</button>
    </div>
  </div>
)

const formatTime = ts => {
  const s = (~~ts % 60).toString()
  const m = (~~(ts / 60) % 60).toString()
  const h = (~~(ts / 3600)).toString()

  const ss = (s.length === 1 ? '0' : '') + s
  const mm = m === '0' ? '' : (m.length === 1 ? '0' : '') + m
  const hh = h === '0' ? '' : h

  return [hh, mm, ss].filter(Boolean).join(':')
}

const GameTime = ({ started, stopped }) => {
  const update = hooks.useUpdate()
  React.useEffect(() => {
    if (!started || stopped) return
    const tid = setInterval(update, 1000)
    return () => clearInterval(tid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, stopped])

  const time = started
    ? formatTime(((stopped || Date.now()) - started) / 1000)
    : '-'

  return <span>Time: {time}</span>
}

const GameOptions = ({ onChange }) => {
  const [validationSchema] = React.useState(() => {
    const req = 'This value is required'

    return yup.object({
      rows: yup
        .number()
        .required(req)
        .min(10)
        .max(30),
      cols: yup
        .number()
        .required(req)
        .min(10)
        .max(30),
      mines: yup
        .number()
        .required(req)
        .min(10)
        .max(100)
        .test('mines', 'Too much mines', function() {
          const { mines, rows, cols } = this.parent
          return mines / (rows * cols) < 0.3
        }),
    })
  })

  const renderField = (name, label) => (
    <div className="field">
      <label>
        <span className="field__label">{label}</span>
        <Field name={name} type="number" />
      </label>
      <ErrorMessage name={name} component="div" className="field__error" />
    </div>
  )

  return (
    <Formik
      initialValues={DEFAULT_GAME_OPTIONS}
      validationSchema={validationSchema}
      onSubmit={onChange}
    >
      {() => (
        <Form className="game-options">
          {renderField('rows', 'Rows:')}
          {renderField('cols', 'Columns:')}
          {renderField('mines', 'Mines:')}

          <button type="submit" className="new-game">
            New game!
          </button>
        </Form>
      )}
    </Formik>
  )
}
