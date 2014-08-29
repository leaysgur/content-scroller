(function() {
  'use strict';

  var gulp   = require('gulp');
  var uglify = require('gulp-uglify');
  var rename = require('gulp-rename');

  gulp.task('uglify', function() {
    gulp.src([
      'src/content-scroller.js'
    ])
        .pipe(uglify({
          mangle: true,
          compress: {
            drop_console: true,
            drop_debugger: true,
          }
        }))
        .pipe(rename({ extname: '.min.js' }))
        .pipe(gulp.dest('dist/'));
  });

  gulp.task('default', ['uglify']);

}());
