import classes from "./styling/privacy.module.css";
import { Link } from "react-router-dom";
import { useNavigate, useLocation } from "react-router-dom";
function Privacy() {
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
          <span>Privacy Policy</span>
        </div>
        <h1>PRIVACY POLICY</h1>
        <div className={classes.privacy_content}>
          <div className={classes.privacy}>
            <p>Policy number: 04022016</p>
            <p>Effective date: August 5, 2025</p>
            <p>Last reviewed date: August 1, 2025 </p>
            <p>Owner: The Developer</p>
            <p>
              Summary: This policy governs the collection of personally
              identifiable information from the University of the People
              students.
            </p>

            <h3>Introduction</h3>
            <p>
              This website (“Platform”, “Service”, “Website”) is a personal
              student project created by a University of the People (UoPeople)
              Computer Science student. It is{" "}
              <strong>
                not officially affiliated with or endorsed by University of the
                People
              </strong>
              . The goal is to provide a dedicated online space for UoPeople
              students to discuss, connect, and support each other in their
              academic journeys.
            </p>
            <p>
              While this forum is not the official property of UoPeople, it is
              developed in the spirit of serving its community and therefore
              strives to{" "}
              <strong>comply with UoPeople’s privacy principles</strong> and
              policies as much as possible. Upon full development and successful
              launch, we intend to seek official recognition from the
              University.
            </p>

            <h3>Information We Collect</h3>

            <h3>a. Personal Information (PII) You Provide</h3>
            <p>
              When you register for an account, post comments, or engage with
              the platform, we may collect personally identifiable information
              (PII) that you voluntarily provide. This includes details such as
              your full name, email address, username, and your academic level
              or the specific course you're enrolled in. Additionally, any
              content you choose to contribute to the forum — including
              comments, replies, profile bios, and feedback — is stored and
              associated with your account. This data is used primarily to
              personalize your experience, identify users within discussions,
              and maintain a sense of academic community within the platform.
            </p>
            <ul>
              <li>Full name</li>
              <li>Email address</li>
              <li>Username</li>
              <li>Academic level or course</li>
              <li>
                Any content you choose to post (e.g., discussion replies,
                feedback, bios)
              </li>
            </ul>
            <p>
              <strong>
                Please do not submit any sensitive personal information
              </strong>{" "}
              (e.g., national identification numbers, government-issued ID,
              financial details, religious or political affiliations, or
              health-related data) on this platform. This site is not designed
              to process or secure such data. You are solely responsible for the
              content you post, and we do not assume liability for information
              you voluntarily disclose in public or private posts.
            </p>

            <h3>b. Usage Data (Non-PII)</h3>
            <p>
              In addition to the personal information you provide, we
              automatically collect certain non-personally identifiable
              information (non-PII) to understand user behavior and improve our
              services. This includes technical data transmitted by your device
              or browser during your interaction with the platform.
            </p>
            <ul>
              <li>IP address and approximate geolocation</li>
              <li>Browser type, version, and operating system</li>
              <li>Device type (e.g., mobile, desktop)</li>
              <li>Referring websites or links</li>
              <li>Pages visited, time spent, and clickstream data</li>
              <li>
                Forum engagement metrics (e.g., likes, comments, login
                frequency)
              </li>
            </ul>
            <p>
              This information is collected via third-party analytics tools and
              server logs. It helps us monitor the platform’s performance,
              detect technical issues, understand how users interact with
              features, and make data-driven improvements. This data is
              anonymized and aggregated wherever possible.
            </p>

            <h3>How We Use Your Data</h3>
            <p>
              The data we collect, both personal and non-personal, is used
              strictly for operating and improving the forum experience. We may
              use your data to:
            </p>
            <ul>
              <li>Identify users and personalize the user interface</li>
              <li>
                Allow users to participate in discussions and academic
                communities
              </li>
              <li>Detect and prevent spam, abuse, or inappropriate content</li>
              <li>Secure the platform and manage session authentication</li>
              <li>
                Analyze user engagement and improve forum structure and UX
              </li>
              <li>
                Backup forum content and support recovery in case of failures
              </li>
              <li>
                Provide administrative support or respond to user concerns
              </li>
            </ul>
            <p>
              Your data <strong>will never be sold, leased, or rented</strong>{" "}
              to any third party for marketing or commercial purposes. However,
              we may share limited data with verified third-party service
              providers (e.g., Render, Netlify, Vercel) for hosting, analytics,
              security scanning, or email services — strictly for technical and
              operational functionality. These vendors are bound by their own
              privacy policies and agreements.
            </p>

            <h3>Data Security</h3>
            <p>
              We are committed to protecting your information through reasonable
              technical, organizational, and administrative measures. Our
              platform is secured using:
            </p>
            <ul>
              <li>SSL/TLS encryption (HTTPS) to protect data in transit</li>
              <li>
                Role-based access control and limited administrator privileges
              </li>
              <li>Regular software updates and security audits</li>
              <li>Rate limiting and brute-force prevention mechanisms</li>
            </ul>
            <p>
              That said, no method of digital storage or online transmission is
              100% secure. While we take appropriate precautions to safeguard
              your information,
              <strong>we cannot guarantee absolute security</strong> against all
              potential cyber threats or unauthorized breaches. By using this
              platform, you acknowledge and accept this inherent risk.
            </p>

            <h3>Your Rights</h3>
            <p>
              We respect your privacy rights and provide ways to control your
              personal information. Depending on your location or local data
              laws, you may have the right to:
            </p>
            <ul>
              <li>Access the personal data we store about you</li>
              <li>Request corrections or updates to inaccurate information</li>
              <li>
                Request deletion of your account and associated forum activity
              </li>
              <li>
                Withdraw previously given consent for email notifications or
                updates
              </li>
            </ul>
            <p>
              To exercise these rights, you may contact the platform
              administrator at:
              <strong style={{ color: "#045edcff" }}>
                {" "}
                contactdeveloperab@gmail.com
              </strong>
              . Requests will be honored within a reasonable timeframe, subject
              to verification of your identity and account.
            </p>

            <h3>User-Generated Content</h3>
            <p>
              This platform is centered around student discussion and content
              sharing. Please be aware of the following responsibilities:
            </p>
            <ul>
              <li>
                Any content you post may be visible to other forum members or
                moderators
              </li>
              <li>
                Do not disclose private or confidential information (e.g.,
                passwords, grades)
              </li>
              <li>
                You retain ownership of your content but grant us a license to
                display it on the forum
              </li>
              <li>
                All posts must adhere to community standards and respectful
                academic conduct
              </li>
            </ul>
            <p>
              We reserve the right to moderate, remove, or report content that
              violates forum guidelines, academic integrity, or applicable laws.
              Repeated violations may result in account suspension or removal.
            </p>

            <h3>Data Hosting and Transfers</h3>
            <p>
              This platform is hosted using cloud-based services that may store
              and process data in international locations, such as the United
              States or Europe. By using this platform, you consent to the
              transfer, storage, and processing of your data in these
              jurisdictions, which may not have equivalent data protection laws
              as your home country.
            </p>
            <p>
              We work only with reputable hosting providers that meet basic
              security standards and provide necessary tools for compliance with
              data protection best practices.
            </p>

            <h3>Third-Party Links or Tools</h3>
            <p>
              Our forum may include embedded tools or links to third-party
              platforms, such as GitHub for project collaboration, Google Forms
              for surveys, or external learning resources. We do not control and
              are not responsible for how these third-party platforms collect,
              use, or protect your data.
            </p>
            <p>
              Please carefully review the privacy policies of any third-party
              service before providing your personal information. Your
              interaction with those services is governed entirely by their
              terms.
            </p>

            <h3>Not an Official UoPeople Service</h3>
            <p>
              This web app is a <strong>personal full-stack project</strong>{" "}
              built by a University of the People student to encourage academic
              collaboration, peer support, and community-building. It is not
              endorsed, maintained, or directly affiliated with the University
              of the People.
            </p>
            <p>
              Until official recognition is granted, this forum operates
              independently and does not represent the university’s official
              views, privacy terms, or academic guidelines. Nonetheless, we make
              every effort to align with the
              <strong> spirit of UoPeople’s data privacy principles</strong>,
              including transparency, user control, and academic integrity.
            </p>

            <h3>Changes to this Privacy Policy</h3>
            <p>
              We may update this Privacy Policy periodically to reflect changes
              in features, compliance requirements, or university involvement.
              All changes will be posted here, and users will be notified in a
              timely manner for any significant revisions that affect the
              handling of their data. Your continued use of the platform after
              such updates constitutes acceptance of the modified terms. In the
              event that the University of the People formally recognizes or
              integrates this forum into its official learning ecosystem,
              additional revisions may be necessary to comply with institutional
              policies, FERPA-like regulations, student protection standards, or
              internal data-sharing protocols. We will ensure that all changes
              are communicated clearly and reflect a shared commitment to
              transparency and responsible data use.
            </p>

            <h3>Changes to this Privacy Policy</h3>
            <p>
              We may update this Privacy Policy periodically to reflect
              improvements to the platform, changes in functionality, or
              evolving legal and compliance requirements. Any updates will be
              made with the intent to protect users' data and improve
              transparency in how we handle personal and non-personal
              information. Users will be notified of any significant changes
              through a visible update banner, a notice on the home page, or via
              email if they have opted to receive communications. Continued use
              of the platform after any such updates will indicate your
              acceptance of the revised policy. We strongly recommend that users
              check this Privacy Policy from time to time to stay informed about
              how their information is being used and protected. Minor changes
              that do not affect users' rights will be applied without formal
              notice, but all major changes will be communicated clearly in
              advance. As this platform was developed as a personal student
              project, the privacy terms currently reflect personal
              responsibility and general best practices modeled after the
              University of the People's own privacy policy. However, if
              University of the People formally recognizes or adopts this
              discussion forum as part of its official platform or services,
              significant changes may be made to this policy to ensure full
              alignment with the university’s legal, administrative, and
              technological data governance standards. In such a case, data
              ownership, security measures, access permissions, and third-party
              sharing rules may be updated to reflect UoPeople’s institutional
              policies. These changes may include additional layers of user
              authentication, data retention protocols, or compliance with
              international data protection frameworks such as GDPR or FERPA.
              Users will be given clear notice of such a transition and what it
              means for their personal information. Until such a formal
              relationship is established, this platform remains an independent
              initiative built for academic collaboration, and any policy
              updates will be guided by transparency, integrity, and the
              evolving needs of the student community.
            </p>

            <h3>Contact</h3>
            <p>
              If you have any questions, concerns, or requests regarding this
              Privacy Policy, the handling of your personal data, or the general
              use of this platform, please feel free to get in touch. We take
              privacy matters seriously and are committed to addressing
              inquiries as promptly as possible.
            </p>
            <p>
              You may contact the site developer directly using the details
              below. Whether you're requesting data access, reporting a security
              issue, or simply seeking clarification, your message is welcome
              and will be treated with care and confidentiality,{" "}
              <strong style={{ color: "#045edcff" }}>
                {" "}
                contactdeveloperab@gmail.com
                {/* <br /> */}
                <Link
                  href="https://github.com/abchangeslaw"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {/* GitHub: [] */}
                </Link>
                {/* <br /> */}
                <Link
                  href="https://www.linkedin.com/in/abchangeslaw"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {/* LinkedIn: abchangeslaw */}
                </Link>
              </strong>
              . While this platform is independently maintained as a personal
              development project, we strive to uphold high standards of
              transparency and user protection. Your feedback is appreciated and
              may contribute to improving the service.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default Privacy;
