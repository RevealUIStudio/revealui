const BeforeLogin = () => {
  return (
    <div className="rounded-xl bg-zinc-900 p-6 shadow-lg">
      <p className="mb-4 text-2xl font-bold">Welcome to RevealUI admin</p>
      <p className="text-lg">
        This is where site admins log in to manage content, users, and settings. If you are a
        customer looking to access your account, please{' '}
        <a className="ml-1 underline" href={`${process.env.NEXT_PUBLIC_SERVER_URL}/login`}>
          log in to the site
        </a>
        .
      </p>
    </div>
  );
};

export default BeforeLogin;
