export const SUBJECTS_DATA = {
  ME: {
    1: {
      1: ['Basic Mathematics', 'Basic Science', 'Communication Skills', 'Engineering Graphics', 'Engineering Workshop Practice', 'Fundamentals of ICT', 'Yoga and Meditation'],
      2: ['Applied Mathematics', 'Applied Science', 'Engineering Drawing', 'Engineering Mechanics', 'Manufacturing Technology', 'Professional Communication', 'Social and Life Skills']
    },
    2: {
      3: ['Strength of Materials', 'Fluid Mechanics and Machinery', 'Thermal Engineering', 'Production Drawing', 'Basic Electrical and Electronics', 'Essence of Indian Constitution', 'Computer Aided Drafting', 'Fundamentals of Python Programming'],
      4: ['Environmental Education and Sustainability', 'Theory of Machines', 'Metrology and Measurement', 'Mechanical Engineering Materials', 'Production Processes', 'Entrepreneurship and Startups', 'Basics of Mechatronics', 'CNC Programming']
    },
    3: {
      5: ['Emerging Trends in Mechanical Engineering', 'Power Engineering', 'Automobile Engineering', 'Seminar and Project Initiation', 'Internship'],
      6: ['Management', 'Design of Machine Elements', 'Industrial Engineering and Quality Control', 'Industrial Hydraulics and Pneumatics', '3D Modelling and Additive Manufacturing', 'Capstone Project']
    }
  },
  CE: {
    1: {
      1: ['Basic Mathematics', 'Basic Science', 'Communication Skills', 'Engineering Graphics', 'Civil Engineering Workshop', 'Fundamentals of ICT', 'Yoga and Meditation'],
      2: ['Applied Mathematics', 'Applied Science', 'Engineering Mechanics', 'Building Materials and Construction', 'Surveying', 'Professional Communication', 'Social and Life Skills']
    },
    2: {
      3: ['Strength of Materials', 'Advanced Surveying', 'Concrete Technology', 'Highway Engineering', 'Essence of Indian Constitution', 'Building Planning and Drawing with CAD', 'Construction Management'],
      4: ['Environmental Education and Sustainability', 'Railway Bridge and Tunnel Engineering', 'Hydraulics', 'Estimating Costing and Valuation', 'Water and Wastewater Engineering', 'Geotechnical Engineering']
    },
    3: {
      5: ['Theory of Structures', 'Water Resource Engineering', 'Emerging Trends in Civil Engineering', 'Seminar and Project Initiation', 'Internship'],
      6: ['Management', 'Design of Steel Structures', 'Contract Management', 'Advanced Construction Techniques', 'Capstone Project']
    }
  },
  CO: {
    1: {
      1: ['Basic Mathematics', 'Basic Science', 'Communication Skills', 'Engineering Graphics', 'Engineering Workshop Practice', 'Fundamentals of ICT', 'Yoga and Meditation'],
      2: ['Applied Mathematics', 'Basic Electrical and Electronics', 'Programming in C', 'Professional Communication', 'Social and Life Skills', 'Linux Basics', 'Web Page Designing']
    },
    2: {
      3: ['Data Structure Using C', 'Database Management System', 'Digital Techniques', 'Object Oriented Programming using C++', 'Computer Graphics', 'Essence of Indian Constitution'],
      4: ['Java Programming', 'Data Communication and Computer Network', 'Microprocessor Programming', 'Environmental Education and Sustainability', 'Python Programming', 'UI/UX Design']
    },
    3: {
      5: ['Operating System', 'Software Engineering', 'Advanced Computer Network', 'Cloud Computing', 'Data Analytics', 'Seminar and Project Initiation', 'Internship', 'Entrepreneurship Development and Startups'],
      6: ['Management', 'Emerging Trends in CO and IT', 'Network and Information Security', 'Artificial Intelligence', 'Web Based Application Development using PHP', 'Capstone Project']
    }
  },
  EJ: {
    1: {
      1: ['Basic Mathematics', 'Basic Science', 'Communication Skills', 'Engineering Graphics', 'Engineering Workshop Practice', 'Fundamentals of ICT', 'Yoga and Meditation'],
      2: ['Applied Mathematics', 'Basic Electronics', 'Elements of Electrical Engineering', 'Programming in C Language', 'Professional Communication', 'Social and Life Skills', 'Electronic Materials and Components']
    },
    2: {
      3: ['Digital Techniques', 'Analog Electronics', 'Circuits and Networks', 'Principles of Electronic Communication', 'Essence of Indian Constitution', 'Basic Python Programming', 'Electronic Measurements and Instrumentation'],
      4: ['Environmental Education and Sustainability', 'Digital Communication Systems', 'Consumer Electronic Systems', 'Microcontroller and Applications', 'Basic Power Electronics', 'Electronic Equipment Maintenance']
    },
    3: {
      5: ['Emerging Trends in EJ', 'Microwave and Radar Engineering', 'Mobile Communication', 'Seminar and Project Initiation', 'Internship'],
      6: ['Management', 'Optical Network and Satellite Communication', 'Capstone Project']
    }
  }
};

export const getSubjects = (dept, year, sem) => {
  return SUBJECTS_DATA[dept]?.[year]?.[sem] || [];
};
