interface PageIntroProps {
  title: string
  description: string
}

export function PageIntro({ title, description }: PageIntroProps) {
  return (
    <section className="page-intro">
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  )
}
