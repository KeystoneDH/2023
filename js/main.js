/*
 *
 * minimal jquery animations for landing page
 *
 */

// scroll view jQuery function
$.fn.scrollView = function() {
    return this.each(function(){
        $('html, body').animate({
            scrollTop: $(this).offset().top
    }, 1000);
    });
}

$(function(){

    $(document).on('scroll', function(d){

        var currTop = $(this).scrollTop();

        if ( currTop > 70 ){
            $('.site-title span').addClass('little');
            $('header .social-icons').addClass('little');
        } else {
            $('.site-title span').removeClass('little')
            $('header .social-icons').removeClass('little')
        }

    });
});