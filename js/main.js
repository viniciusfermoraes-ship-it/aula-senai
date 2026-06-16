document.addEventListener('DOMContentLoaded', () => {
  // 1. Navbar Scroll Effect
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    // Update active nav links based on scroll
    updateActiveNavLink();
  });

  // 2. Mobile Menu Toggle
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = navToggle.querySelector('svg');
      if (navMenu.classList.contains('active')) {
        // Switch to close icon
        icon.innerHTML = '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor"/>';
      } else {
        // Switch to hamburger icon
        icon.innerHTML = '<path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor"/>';
      }
    });

    // Close menu when clicking link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        const icon = navToggle.querySelector('svg');
        icon.innerHTML = '<path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor"/>';
      });
    });
  }

  // 3. Navigation Link Active Update
  const sections = document.querySelectorAll('section, header');
  const navLinks = document.querySelectorAll('.nav-link');

  function updateActiveNavLink() {
    let scrollPos = window.scrollY + 150;
    sections.forEach(section => {
      if (scrollPos >= section.offsetTop && scrollPos < section.offsetTop + section.offsetHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (section.getAttribute('id') && link.getAttribute('href') === `#${section.getAttribute('id')}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // 4. Particle Canvas System (Hero background)
  const canvas = document.getElementById('canvas-particles');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particlesArray = [];
    
    // Resize canvas
    function resizeCanvas() {
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Particle class
    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 4 + 1;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.speedY = Math.random() * 0.4 - 0.2;
        this.color = Math.random() > 0.5 ? 'rgba(100, 181, 160, 0.25)' : 'rgba(124, 111, 205, 0.25)';
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        if (this.x > canvas.width) this.x = 0;
        else if (this.x < 0) this.x = canvas.width;
        
        if (this.y > canvas.height) this.y = 0;
        else if (this.y < 0) this.y = canvas.height;
      }
      draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function initParticles() {
      particlesArray = [];
      const numberOfParticles = Math.floor((canvas.width * canvas.height) / 15000);
      for (let i = 0; i < numberOfParticles; i++) {
        particlesArray.push(new Particle());
      }
    }
    initParticles();
    window.addEventListener('resize', initParticles);

    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
      }
      requestAnimationFrame(animateParticles);
    }
    animateParticles();
  }

  // 5. Counters Animation (Stats Section)
  const statsSection = document.querySelector('.stats');
  const counters = document.querySelectorAll('.stat-card .number');
  let startedCounter = false;

  function startCounter(el) {
    const target = parseInt(el.getAttribute('data-target'));
    const suffix = el.getAttribute('data-suffix') || '';
    let count = 0;
    const speed = target / 100; // Complete in 100 steps
    
    const updateCount = () => {
      if (count < target) {
        count += speed;
        el.innerText = Math.floor(count) + suffix;
        setTimeout(updateCount, 15);
      } else {
        el.innerText = target + suffix;
      }
    };
    updateCount();
  }

  // Scroll Reveal and Counters Trigger using Intersection Observer
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        
        // If it's the stats section, start counters
        if (entry.target.classList.contains('stats') && !startedCounter) {
          counters.forEach(counter => startCounter(counter));
          startedCounter = true;
        }
      }
    });
  }, {
    threshold: 0.15
  });

  revealElements.forEach(el => observer.observe(el));
  if (statsSection) observer.observe(statsSection);

  // 6. Testimonials Carousel
  const track = document.querySelector('.carousel-track');
  const dots = document.querySelectorAll('.carousel-dot');
  let currentIndex = 0;
  let autoplayInterval;

  function updateCarousel(index) {
    if (!track) return;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach(dot => dot.classList.remove('active'));
    dots[index].classList.add('active');
    currentIndex = index;
  }

  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      updateCarousel(index);
      resetAutoplay();
    });
  });

  function startAutoplay() {
    autoplayInterval = setInterval(() => {
      if (dots.length === 0) return;
      let nextIndex = (currentIndex + 1) % dots.length;
      updateCarousel(nextIndex);
    }, 6000);
  }

  function resetAutoplay() {
    clearInterval(autoplayInterval);
    startAutoplay();
  }
  
  if (track && dots.length > 0) {
    startAutoplay();
  }

  // 7. FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all other items
      faqItems.forEach(otherItem => {
        otherItem.classList.remove('active');
      });

      // Toggle current item
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // 8. Newsletter form handling
  const newsletterForm = document.querySelector('.cta-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      if (emailInput && emailInput.value) {
        // Clean input
        const userEmail = emailInput.value;
        emailInput.value = '';
        
        // Show dynamic confirmation toast
        showToast(`Obrigado! Enviamos um guia de boas-vindas para o e-mail: ${userEmail}`);
      }
    });
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '30px';
    toast.style.backgroundColor = 'var(--secondary)';
    toast.style.color = '#FFFFFF';
    toast.style.padding = '1rem 2rem';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    toast.style.zIndex = '9999';
    toast.style.fontWeight = '600';
    toast.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    
    document.body.appendChild(toast);
    toast.innerText = message;
    
    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 100);
    
    // Animate out
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => {
        toast.remove();
      }, 500);
    }, 5000);
  }
});
