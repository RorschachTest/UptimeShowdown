import { chapterById } from '../../levels'
import { useGameStore } from '../../store'
import { QuestionCard } from '../estimate/QuestionCard'
import { CARD_HUES, HUE, tint } from './hues'
import { MiniDiagram } from './MiniDiagram'
import { Visual } from './Visual'

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
  const hue = CARD_HUES[lesson.card % CARD_HUES.length]!

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
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold ${i === lesson.card ? 'bg-ink text-piece' : 'hover:bg-board'}`}
              >
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-full text-xs text-white"
                  style={{ background: HUE[CARD_HUES[i % CARD_HUES.length]!] }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {c.title}
                {c.visual && ['ringLab', 'quorumLab', 'bitPacker', 'clockLab'].includes(c.visual.kind) && (
                  <span className="ml-auto rounded bg-ryw px-1 text-[10px] font-bold text-white">LAB</span>
                )}
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

      {/* Bottom padding lets the last card or question scroll up to the middle of the screen. */}
      <div className="flex-1 overflow-y-auto bg-board p-6 pb-[50vh]">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {!atQuiz && card ? (
            <article className="piece overflow-hidden">
              <div className="h-2" style={{ background: HUE[hue] }} aria-hidden="true" />
              <div className="px-6 py-5">
                <p className="text-xs font-semibold" style={{ color: HUE[hue] }}>
                  Card {lesson.card + 1} of {cards.length}
                </p>
                <h2 className="mt-1 text-2xl font-bold">{card.title}</h2>
                <p className="mt-2 max-w-[65ch] leading-relaxed">{card.body}</p>
                {card.visual && (
                  <div className="mt-4">
                    <Visual visual={card.visual} />
                  </div>
                )}
                {card.diagram && (
                  <div className="mt-4">
                    <MiniDiagram spec={card.diagram} />
                  </div>
                )}
                {(card.solves || card.worsens) && (
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    {card.solves && (
                      <p className="rounded-lg px-3 py-2" style={{ background: tint('green') }}>
                        <span className="block font-bold text-ok">✓ Solves</span>
                        {card.solves}
                      </p>
                    )}
                    {card.worsens && (
                      <p className="rounded-lg px-3 py-2" style={{ background: tint('red') }}>
                        <span className="block font-bold text-bad">✗ Worsens</span>
                        {card.worsens}
                      </p>
                    )}
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
