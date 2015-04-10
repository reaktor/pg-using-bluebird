module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['test/**/*.js']
      },
      test_with_xunit: {
        options: {
          reporter: 'xunit',
          quiet: true,
          captureFile: 'test-report.xml'
        },
        src: ['test/**/*.js']
      }
    },
    jshint: {
      options: {
        asi: true,
        node: true,
        mocha: true
      },
      files: ['Gruntfile.js', './*.js', 'test/**/*.js']
    }
  })

  grunt.loadNpmTasks('grunt-mocha-test')
  grunt.loadNpmTasks('grunt-contrib-jshint')

  grunt.registerTask('default', ['jshint', 'mochaTest'])
  grunt.registerTask('ci', ['jshint','mochaTest:test_with_xunit'])
};
