import PoweredByRevealUI from '../PoweredByRevealUI/index';

const BeforeDashboard = () => {
  return (
    <div className="relative mx-auto w-full rounded-lg bg-zinc-900 p-8 shadow-md">
      <h1 className="mb-6 text-3xl font-bold text-white">Welcome to RevealUI CMS</h1>

      <div className="space-y-6 leading-relaxed text-zinc-300">
        <p className="font-normal">Manage your content, users, and settings from this dashboard.</p>
        <p className="font-normal">
          New to the CMS? Start by creating a new page or post. Navigate to the "Content" tab in the
          sidebar and click "Add New".
        </p>
        <p className="font-normal">To manage users, go to the "Users" tab in the sidebar.</p>
        <p className="font-normal">
          Adjust settings by clicking on the "Settings" tab in the sidebar.
        </p>
      </div>

      <PoweredByRevealUI />
    </div>
  );
};

export default BeforeDashboard;
