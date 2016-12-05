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
    eslint: {
      target: ['Gruntfile.js', './*.js', 'test/**/*.js'],
      options: process.env.BUILD_NUMBER ? {
        format: 'checkstyle',
        outputFile: 'eslint3.xml'
      } : {}
    }
  })

  grunt.loadNpmTasks('grunt-mocha-test')
  grunt.loadNpmTasks('grunt-eslint')

  grunt.registerTask('default', ['eslint', 'mochaTest'])
  grunt.registerTask('ci', ['eslint','mochaTest:test_with_xunit'])
}
