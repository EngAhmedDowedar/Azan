// تسجيل Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful');
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

// دالة لتحميل ملف الأذان
function loadAzanAudio() {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = 'sounds/azan.mp3';
    audio.load();
    
    audio.addEventListener('canplaythrough', () => resolve(audio), false);
    audio.addEventListener('error', reject, false);
  });
}

let azanAudio;

// تعديل دالة fetchPrayerTimes لدعم العمل بدون إنترنت
function fetchPrayerTimes(city, method) {
  const date = today.toISOString().split('T')[0];
  const apiUrl = `https://api.aladhan.com/v1/timingsByCity/${date}?city=${city}&country=EG&method=${method}`;
  
  // محاولة جلب البيانات من الشبكة أولاً
  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      if(data.code === 200) {
        // حفظ البيانات في localStorage للاستخدام بدون إنترنت
        localStorage.setItem('prayerTimes', JSON.stringify({
          timings: data.data.timings,
          date: date,
          city: city,
          method: method
        }));
        
        displayPrayerTimes(data.data.timings);
        setupNextPrayer(data.data.timings);
      }
    })
    .catch(error => {
      console.error('Error fetching prayer times:', error);
      // إذا فشل الاتصال، جلب البيانات المحفوظة
      const savedData = localStorage.getItem('prayerTimes');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.date === date && parsedData.city === city && parsedData.method === method) {
          displayPrayerTimes(parsedData.timings);
          setupNextPrayer(parsedData.timings);
          Swal.fire({
            icon: 'info',
            title: 'وضع عدم الاتصال',
            text: 'يتم عرض بيانات مخزنة مسبقاً',
            confirmButtonText: 'حسناً'
          });
          return;
        }
      }
      
      Swal.fire({
        icon: 'error',
        title: 'خطأ في الاتصال',
        text: 'تعذر الاتصال بالإنترنت ولا توجد بيانات مخزنة',
        confirmButtonText: 'حسناً'
      });
    });
}

// تعديل دالة showPrayerNotification لاستخدام الصوت المخزن
function showPrayerNotification() {
  if (!azanAudio) {
    loadAzanAudio()
      .then(audio => {
        azanAudio = audio;
        azanAudio.play().catch(e => console.log('Audio playback failed:', e));
      })
      .catch(error => {
        console.error('Error loading azan audio:', error);
        // استخدام صوت بديل إذا كان متصلاً بالإنترنت
        const onlineAudio = new Audio('https://www.islamcan.com/audio/adhan/azan1.mp3');
        onlineAudio.play().catch(e => console.log('Online audio playback failed:', e));
      });
  } else {
    azanAudio.play().catch(e => console.log('Audio playback failed:', e));
  }
  
  Swal.fire({
    title: 'حان وقت الأذان',
    text: `حان الآن وقت صلاة ${nextPrayerName.textContent}`,
    icon: 'info',
    confirmButtonText: 'تم',
    timer: 10000,
    timerProgressBar: true
  });
}

document.addEventListener('DOMContentLoaded', function() {
  
    // Elements
    let countdownInterval; // ده المتغير اللي هنستخدمه علشان نوقف العداد القديم
    const citySelect = document.getElementById('city');
    const methodSelect = document.getElementById('method');
    const prayerTimesContainer = document.getElementById('prayer-times-container');
    const dateDisplay = document.getElementById('date-display');
    const nextPrayerName = document.getElementById('next-prayer-name');
    const nextPrayerTime = document.getElementById('next-prayer-time');
    const countdownElement = document.getElementById('countdown');

    // Current date in Hijri and Gregorian
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.textContent = today.toLocaleDateString('ar-EG', options);

    // Prayer names
    const prayerNames = {
        Fajr: 'الفجر',
        Dhuhr: 'الظهر',
        Asr: 'العصر',
        Maghrib: 'المغرب',
        Isha: 'العشاء'
    };

    // Fetch prayer times
    function fetchPrayerTimes(city, method) {
        const date = today.toISOString().split('T')[0];
        const apiUrl = `https://api.aladhan.com/v1/timingsByCity/${date}?city=${city}&country=EG&method=${method}`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if(data.code === 200) {
                    displayPrayerTimes(data.data.timings);
                    setupNextPrayer(data.data.timings);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'خطأ',
                        text: 'حدث خطأ أثناء جلب بيانات أوقات الصلاة',
                        confirmButtonText: 'حسناً'
                    });
                }
            })
            .catch(error => {
                console.error('Error fetching prayer times:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'خطأ في الاتصال',
                    text: 'تعذر الاتصال بخادم البيانات',
                    confirmButtonText: 'حسناً'
                });
            });
    }

    // Display prayer times
    function displayPrayerTimes(timings) {
        prayerTimesContainer.innerHTML = '';
        
        const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        
        prayers.forEach(prayer => {
            const prayerTime = timings[prayer].split(' ')[0];
            const prayerCard = document.createElement('div');
            prayerCard.className = 'prayer-card bg-white p-4 rounded-lg shadow text-center cursor-pointer';
            prayerCard.innerHTML = `
                <div class="text-blue-600 mb-2">
                    <i class="fas ${getPrayerIcon(prayer)} text-2xl"></i>
                </div>
                <h3 class="font-bold text-lg">${prayerNames[prayer]}</h3>
                <p class="text-gray-600">${prayerTime}</p>
            `;
            prayerTimesContainer.appendChild(prayerCard);
        });
    }

    // Get icon for each prayer
    function getPrayerIcon(prayer) {
        switch(prayer) {
            case 'Fajr': return 'fa-sun';
            case 'Dhuhr': return 'fa-sun';
            case 'Asr': return 'fa-sun';
            case 'Maghrib': return 'fa-moon';
            case 'Isha': return 'fa-moon';
            default: return 'fa-clock';
        }
    }

    // Setup next prayer countdown
    function setupNextPrayer(timings) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const prayers = [
          { name: 'Fajr', time: timings.Fajr },
          { name: 'Dhuhr', time: timings.Dhuhr },
          { name: 'Asr', time: timings.Asr },
          { name: 'Maghrib', time: timings.Maghrib },
          { name: 'Isha', time: timings.Isha }
      ];

      const prayerTimesInMinutes = prayers.map(prayer => {
          const [hours, minutes] = prayer.time.split(' ')[0].split(':').map(Number);
          return {
              name: prayer.name,
              timeInMinutes: hours * 60 + minutes
          };
      });

      let nextPrayer = null;
      for (const prayer of prayerTimesInMinutes) {
          if (prayer.timeInMinutes > currentTime) {
              nextPrayer = prayer;
              break;
          }
      }

      if (!nextPrayer) {
          nextPrayer = prayerTimesInMinutes[0];
          nextPrayer = {
              name: nextPrayer.name,
              timeInMinutes: nextPrayer.timeInMinutes + 1440
          };
      }

      nextPrayerName.textContent = prayerNames[nextPrayer.name];
      const [hours, minutes] = timings[nextPrayer.name].split(' ')[0].split(':');
      nextPrayerTime.textContent = `${hours}:${minutes}`;

      updateCountdown(nextPrayer.timeInMinutes, currentTime);

      // 🧠 هنا وقف العدادات القديمة
      if (countdownInterval) clearInterval(countdownInterval);

      countdownInterval = setInterval(() => {
          const now = new Date();
          const currentTime = now.getHours() * 60 + now.getMinutes();
          updateCountdown(nextPrayer.timeInMinutes, currentTime);
      }, 1000);
  }


    // Update countdown
    function updateCountdown(prayerTimeInMinutes, currentTimeInMinutes) {
        let diff = prayerTimeInMinutes - currentTimeInMinutes;
        
        if (diff < 0) {
            // This should theoretically not happen due to our setupNextPrayer logic
            diff = 0;
        }
        
        const hours = Math.floor(diff / 60);
        const minutes = diff % 60;
        
        countdownElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Show notification when prayer time is reached
        if (diff === 0) {
            showPrayerNotification();
        }
    }

    // Show prayer notification
    function showPrayerNotification() {
        const audio = new Audio('https://www.islamcan.com/audio/adhan/azan1.mp3');
        audio.play().catch(e => console.log('Audio playback failed:', e));
        
        Swal.fire({
            title: 'حان وقت الأذان',
            text: `حان الآن وقت صلاة ${nextPrayerName.textContent}`,
            icon: 'info',
            confirmButtonText: 'تم',
            timer: 10000,
            timerProgressBar: true
        });
    }

    // Event listeners
    citySelect.addEventListener('change', () => {
        fetchPrayerTimes(citySelect.value, methodSelect.value);
    });
    
    methodSelect.addEventListener('change', () => {
        fetchPrayerTimes(citySelect.value, methodSelect.value);
    });

    // Initial load
    fetchPrayerTimes(citySelect.value, methodSelect.value);
});