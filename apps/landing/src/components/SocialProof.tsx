export function SocialProof() {
  const testimonials = [
    {
      content: "RevealUI transformed how we deliver client projects. The white-label approach and AI features save us hours every week.",
      author: {
        name: "Sarah Chen",
        title: "Founder, DigitalCraft Agency",
        avatar: "SC",
      },
    },
    {
      content: "Finally, a CMS that gives us full control. Our clients love the custom branding options and we love the development speed.",
      author: {
        name: "Marcus Rodriguez",
        title: "Technical Director, WebFlow Studios",
        avatar: "MR",
      },
    },
    {
      content: "The multi-tenant architecture is game-changing for our agency. We can manage 50+ client sites from one dashboard.",
      author: {
        name: "Emily Watson",
        title: "CEO, Creative Solutions Inc.",
        avatar: "EW",
      },
    },
  ]

  return (
    <section className="py-24 bg-gray-50 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">Trusted by Agencies</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Join the agencies already using RevealUI
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="flex flex-col justify-between rounded-2xl bg-white p-8 shadow-lg">
              <blockquote className="text-gray-900">
                <p className="text-lg leading-7">&ldquo;{testimonial.content}&rdquo;</p>
              </blockquote>
              <div className="mt-6 flex items-center gap-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                  {testimonial.author.avatar}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.author.name}</div>
                  <div className="text-gray-600">{testimonial.author.title}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-16 flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">50+</div>
            <div className="text-sm text-gray-600">Active Agencies</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">500+</div>
            <div className="text-sm text-gray-600">Client Websites</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">99.9%</div>
            <div className="text-sm text-gray-600">Uptime</div>
          </div>
        </div>
      </div>
    </section>
  )
}