import classes from "./styling/terms.module.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import github from "../assets/github.png";
import linkedinn from "../assets/linkedinn.png";
import gmail from "../assets/communication.png";
function Terms() {
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/login");
    }
  };
  return (
    <>
      <div className={classes.privacy_container}>
        <div className={classes.breadcrumbs}>
          <span onClick={handleBack}>Back</span>
          <span>/</span>
          <span>Terms of Service</span>
        </div>
        <small>Terms and Conditions</small>
        <h1>
          AGREEMENT BETWEEN University of the People Students and The Developer
        </h1>
        <div className={classes.privacy_content}>
          <p>
            These Terms and Conditions ("Terms") govern your access to and use
            of this platform (the “Site”), which is operated as an independent
            full-stack project intended for educational and community engagement
            purposes. By accessing or using the Site, you agree to be bound by
            these Terms. If you do not agree with any part of these Terms, you
            must discontinue use of the Site.
          </p>

          <h3>1. Use of the Platform</h3>
          <p>
            You agree to use the Site solely for lawful purposes and in
            accordance with these Terms. You are responsible for any content you
            post and the actions you take while using the platform. The platform
            is designed for academic discussion, collaboration, and information
            sharing within the context of University of the People’s community,
            but it is not an official service of the University.
          </p>

          <h3>2. User Eligibility</h3>
          <p>
            This Site is intended for users who are at least 13 years old. By
            using the Site, you confirm that you meet this age requirement and
            have the legal capacity to agree to these Terms. Users are solely
            responsible for maintaining the confidentiality of their login
            credentials and for all activities that occur under their accounts.
          </p>

          <h3>3. Content Ownership and Responsibility</h3>
          <p>
            All content you submit, post, or display remains your intellectual
            property. However, by submitting content to the Site, you grant us a
            non-exclusive, worldwide, royalty-free license to use, reproduce,
            display, and distribute such content for the purpose of operating
            and improving the platform.
          </p>
          <p>
            You are solely responsible for ensuring that any content you post
            complies with all applicable laws and does not infringe upon the
            rights of others. We reserve the right to remove or moderate content
            that violates these Terms or the rights of third parties.
          </p>

          <h3>4. Prohibited Conduct</h3>
          <p>You agree not to engage in any of the following:</p>
          <ul>
            <li>
              Posting or sharing false, harmful, or misleading information
            </li>
            <li>Uploading or distributing viruses, malware, or harmful code</li>
            <li>Engaging in harassment, abuse, or intimidation of any kind</li>
            <li>
              Attempting to gain unauthorized access to the platform or its data
            </li>
            <li>
              Sharing content that contains personal, political, or sensitive
              data
            </li>
          </ul>
          <p>
            Any user found in violation of these rules may have their access
            suspended or permanently revoked at the discretion of the developer.
          </p>

          <h3>5. Intellectual Property</h3>
          <p>
            Unless otherwise stated, the design, structure, and underlying
            source code of the platform are the intellectual property of the
            developer. You may not copy, reproduce, or redistribute any portion
            of the site without explicit permission, except for personal
            academic use.
          </p>

          <h3>6. Privacy and Data Handling</h3>
          <p>
            Your use of this Site is also governed by our Privacy Policy. Please
            review it carefully to understand how we collect, use, and protect
            your information. We strive to maintain data practices that align
            with University of the People’s privacy expectations, though we
            operate independently.
          </p>

          <h3>7. Third-Party Services</h3>
          <p>
            This platform may incorporate tools or links from third-party
            services (e.g., GitHub, Render, or Google Forms). We are not
            responsible for the content, security, or data practices of these
            external sites. You are advised to read their terms and privacy
            policies before interacting with them.
          </p>

          <h3>8. Platform Availability</h3>
          <p>
            While efforts are made to maintain uptime and system integrity, the
            platform is provided “as is” without warranties of any kind. We make
            no guarantee that the site will be available at all times or free of
            bugs, errors, or other disruptions.
          </p>

          <h3>9. Limitation of Liability</h3>
          <p>
            The developer shall not be held liable for any direct, indirect,
            incidental, or consequential damages arising from your use or
            inability to use the Site, including but not limited to loss of
            data, loss of reputation, or academic disruptions. Your use of the
            Site is at your own risk.
          </p>

          <h3>10. Modification of Terms</h3>
          <p>
            These Terms may be modified or updated at any time to reflect
            changes in the project’s scope, user feedback, or legal
            requirements. Users will be notified of significant updates through
            in-site announcements or email if provided. Continued use of the
            Site after such updates constitutes acceptance of the revised Terms.
          </p>
          <p>
            In the event that the University of the People formally recognizes
            this discussion forum as part of its academic ecosystem, additional
            terms or adjustments may be applied to reflect that recognition,
            including but not limited to content moderation, institutional data
            handling standards, and policy integration. Such changes will be
            communicated transparently and will supersede any prior terms where
            applicable.
          </p>

          <h3>11. Termination</h3>
          <p>
            We reserve the right to terminate or suspend access to the Site at
            any time, without prior notice, for conduct that we believe violates
            these Terms or is otherwise harmful to the platform or its users.
          </p>

          <h3>12. Governing Law</h3>
          <p>
            These Terms shall be governed by and construed in accordance with
            applicable international digital use standards and educational
            community guidelines. Any disputes arising out of these Terms shall
            be resolved through amicable dialogue; where not possible, standard
            dispute resolution procedures will be followed.
          </p>

          <h3>13. Contact Information</h3>
          <p>
            If you have questions, feedback, or concerns regarding these Terms
            and Conditions, you may contact the developer at:{" "}
          </p>
          <p className={classes.contact_info}>
            <Link
              to="https://www.linkedin.com/in/abreham-semu-fullstack-developer"
              target="_blank"
              rel="noopener noreferrer"
              className={classes.contact_infoo}
            >
              <img src={linkedinn} alt="" />
            </Link>
            <strong style={{ color: "#045edcff" }}>
              {" "}
              let's connect on linkedin
            </strong>
            <br />
            <Link
              to="mailto:contactdeveloperab@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className={classes.contact_info}
            >
              <img src={gmail} alt="" />
            </Link>
            <strong>
              {" "}
              contactdeveloperab@gmail.com
              <br />
            </strong>
            <Link
              to="https://github.com/irdamdp"
              target="_blank"
              rel="noopener noreferrer"
              className={classes.contact_info}
              style={{ color: "#000000ff" }}
            >
              <img src={github} alt="" /> github profile
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default Terms;
