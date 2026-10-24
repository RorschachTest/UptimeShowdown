import { chapterById } from '../../levels'
import { useGameStore } from '../../store'
import { QuestionCard } from '../estimate/QuestionCard'
import { MiniDiagram } from './MiniDiagram'

/** The Learn step: concept cards one at a time, then a short quiz. Passing the quiz marks the chapter learned. */
export function LessonView() {
  const chapterId = useGameStore((s) => s.chapterId)
  const lesson = useGameStore((s) => s.lesson)
  const learned = useGameStore((s) => s.progress[s.chapterId]?.learned ?? false)
  const { setLessonCard, setLessonAnswer, checkLessonAnswer, retryLessonQuestion, setView } = useGameStore.getState()
  const entry = chapterById(chapterId)
  const { cards, quiz, summary } = entry.lesson
  // One past the last card is the quiz.
  const atQuiz = lesson.card >= cards.length
  const card = cards[lesson.card]

  return (
    <div className="flex min-h-0 flex-1">
      <nav className="w-64 shrink-0 overflow-y-auto border-r-2 border-ink bg-panel p-4" aria-label="Lesson">
        <p className="text-xs text-ink-soft">{entry.topic}</p>
        <h2 className="mt-1 text-lg leading-tight font-bold">{entry.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{summary}</p>
        <ol className="mt-4 flex flex-col gap-1">
          {cards.map((c, i) => (
            <li key={c.title}>
              <button
                type="button"
                aria-current={i === lesson.card ? 'step' : undefined}
                onClick={() => setLessonCard(i)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold ${i === lesson.card ? 'bg-ink text-piece' : 'hover:bg-board'}`}
              >
                {i + 1}. {c.title}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-current={atQuiz ? 'step' : undefined}
              onClick={() => setLessonCard(cards.length)}
              className={`w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold ${atQuiz ? 'bg-ink text-piece' : 'hover:bg-board'}`}
            >
              Check yourself {learned && <span className="text-ok">✓</span>}
            </button>
          </li>
        </ol>
      </nav>

      <div className="flex-1 overflow-y-auto bg-board p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {!atQuiz && card ? (
            <article className="piece px-6 py-5">
              <p className="text-xs text-ink-soft">
                Card {lesson.card + 1} of {cards.length}
              </p>
              <h2 className="mt-1 text-2xl font-bold">{card.title}</h2>
              <p className="mt-2 max-w-[65ch] leading-relaxed">{card.body}</p>
              {(card.solves || card.worsens) && (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-board px-3 py-2 text-sm">
                  {card.solves && (
                    <>
                      <dt className="font-semibold text-ok">Solves</dt>
                      <dd>{card.solves}</dd>
                    </>
                  )}
                  {card.worsens && (
                    <>
                      <dt className="font-semibold text-bad">Worsens</dt>
                      <dd>{card.worsens}</dd>
                    </>
                  )}
                </dl>
              )}
              {card.diagram && (
                <div className="mt-4">
                  <MiniDiagram spec={card.diagram} />
                </div>
              )}
              <div className="mt-5 flex justify-between">
                <button
                  type="button"
                  disabled={lesson.card === 0}
                  onClick={() => setLessonCard(lesson.card - 1)}
                  className="rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-semibold hover:bg-board disabled:opacity-30"
                >
                  Back
                </button>
                <button type="button" onClick={() => setLessonCard(lesson.card + 1)} className="piece bg-ink px-3 py-1.5 text-sm font-bold text-piece">
                  {lesson.card + 1 === cards.length ? 'Check yourself' : 'Next'}
                </button>
              </div>
            </article>
          ) : (
            <>
              <header>
                <h2 className="text-2xl font-bold">Check yourself</h2>
                <p className="mt-1 text-ink-soft">Get every question right to mark this chapter learned. Retries are free.</p>
              </header>
              {quiz.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  index={i}
                  question={q}
                  answer={lesson.answers[q.id]}
                  grade={lesson.grades[q.id]}
                  onAnswer={(a) => setLessonAnswer(q.id, a)}
                  onCheck={() => checkLessonAnswer(q.id)}
                  onRetry={() => retryLessonQuestion(q.id)}
                />
              ))}
              <section className="flex items-center justify-between rounded-xl border-2 border-ink bg-piece px-5 py-3" role="status">
                <p className="text-sm">{learned ? 'Learned. Now put it into practice.' : 'You can start the hands-on any time.'}</p>
                <button type="button" onClick={() => setView('play')} className="piece bg-ink px-3 py-1.5 font-bold text-piece">
                  Start the hands-on
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
