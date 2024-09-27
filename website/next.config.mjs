/** @type {import('next').NextConfig} */
const nextConfig = {
	output: "export",
	webpack: (config, { isServer }) => {
		config.experiments = { syncWebAssembly: true, layers: true, };
		return config;
	},
};

export default nextConfig;
