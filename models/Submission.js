import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  submission_type: {
    type: String,
    required: true,
    enum: [
      'ambassador',
      'product_order',
      'advertise',
      'donate',
      'job_application',
      'question_comment',
      'outreach_participation',
      'agent_request'
    ]
  },
  reference_number: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'contacted', 'completed', 'cancelled'],
    default: 'new'
  },
  // Personal Information
  full_name: String,
  email: String,
  phone: String,
  id_number: String,
  address: String,
  city: String,
  postal_code: String,
  branch_location: String,
  
  // Ambassador specific
  motivation: String,
  areas_of_interest: [String],
  availability: String,
  id_document_url: String,
  selfie_url: String,
  
  // Product order
  products_ordered: [{
    name: String,
    quantity: Number,
    price: Number
  }],
  delivery_address: String,
  proof_of_payment_url: String,
  
  // Donation
  donation_amount: Number,
  donation_type: String,
  project_allocation: String,
  
  // Company/Advertisement
  company_name: String,
  company_registration: String,
  industry: String,
  ad_type: String,
  budget_range: String,
  company_logo_url: String,
  
  // Job application
  position_applied: String,
  qualifications: String,
  experience: String,
  salary_expectation: String,
  cv_url: String,
  
  // Question/Comment
  message_category: String,
  message_type: String,
  message: String,
  contact_preference: String,
  
  // Outreach
  age_group: String,
  outreach_project: String,
  role_interest: String,
  skills_to_contribute: String,
  transportation_needs: String,
  emergency_contact: String,
  
  // Agent request
  urgent_reason: String,
  preferred_contact_method: String,
  best_time_to_contact: String,
  brief_description: String,
  
  // Admin fields
  assigned_to: String,
  notes: String,
  
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  created_date: {
    type: Date,
    default: Date.now
  },
  updated_date: {
    type: Date,
    default: Date.now
  }
});

// Update updated_date on save
submissionSchema.pre('save', function(next) {
  this.updated_date = Date.now();
  next();
});

// Generate reference number before saving
submissionSchema.pre('save', async function(next) {
  if (!this.reference_number) {
    const count = await mongoose.model('Submission').countDocuments();
    this.reference_number = `MPD-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Indexes for better query performance
submissionSchema.index({ email: 1 });
submissionSchema.index({ status: 1 });
submissionSchema.index({ submission_type: 1 });
submissionSchema.index({ created_date: -1 });
submissionSchema.index({ user: 1 });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;

