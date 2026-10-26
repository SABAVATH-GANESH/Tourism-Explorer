import pkg from './package.json' with {type:'json'}

export default {
	name: pkg.name,
	triggers: {
		keywords: ['tourist attractions', 'tourist places', 'things to do', 'things to see',
			'places to visit', 'landmarks', 'sights', 'sightseeing', 'points of interest', 'museums']
	},
	query_format: {
		regex: [
			'((best|top|famous|popular)\\s+)?(touris[tm]?\\s+(attractions?|places?|spots?|destinations?)|attractions?|things\\s+to\\s+(do|see)|places\\s+to\\s+(visit|see|go)|landmarks?|sights?|sightseeing|points?\\s+of\\s+interest)\\s+(in|near|around|at)\\s+HD_LOCATION(__\\w+)?.*',
			'((best|top|famous|popular)\\s+)?(museums?|monuments?|temples?|forts?|viewpoints?|parks?|historic(al)?\\s+sites?)\\s+(in|near|around|at)\\s+HD_LOCATION(__\\w+)?.*'
		]
	},
	server: {
		location: 'dist/backend/index.js',
		configPath: 'dist/backend/wrangler.jsonc',
		schemaPath: 'dist/backend/schema.jsonc'
	},
	client: {
		location: pkg.module,
		moduleName: pkg.umdName || 'HD' + pkg.name,
		baseURL: '/' + pkg.name,
	},
	format: {
		mainline: true,
		sidebar: true
	},
	permissions: {

	},
	info: {

	},
	github: "",
	demovideo: ""
}