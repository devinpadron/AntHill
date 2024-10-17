import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Button, 
  Alert, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthProvider';
import User from '../../data/class/userClass';

const { width, height } = Dimensions.get('window');

const ProfilePage = () => {
  const [password, setPassword] = useState<string>('');
  const { user, signOut, firestoreData, isLoading } = useAuth();
  const navigation = useNavigation();

  const handlePasswordChange = (newPassword: string) => {
    setPassword(newPassword);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        // Add account deletion functionality
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          onPress: async () => {
            try {
              await signOut();
              // Navigation should be handled by the auth state listener in UserContext
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Sign Out Failed', 'An error occurred while signing out. Please try again.');
            }
          } 
        },
      ]
    );
  };

  const handleSaveChanges = () => {
    // Add phone number update functionality
    // Add password change functionality
  };

  /*if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }*/

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>No user data available. Please log in.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={`${firestoreData.getFirstName()} ${firestoreData.getLastName()}`} editable={false} />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={firestoreData.getEmail()} editable={false} />

        <Text style={styles.label}>Company</Text>
        <TextInput style={styles.input} value={firestoreData.getCompany()} editable={false} />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry
          placeholder="Enter new password"
        />

        <Button title="Save Changes" onPress={handleSaveChanges} />
        <Button title="Sign Out" color="gray" onPress={handleSignOut} />
      </ScrollView>

      <View style={styles.deleteButtonContainer}>
        <Button title="Delete Account" color="red" onPress={handleDeleteAccount} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: width * 0.05,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: height * 0.08,
  },
  label: {
    fontSize: height * 0.02,
    marginBottom: height * 0.01,
    fontWeight: 'bold',
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    padding: width * 0.04,
    marginBottom: height * 0.02,
    borderRadius: width * 0.02,
  },
  deleteButtonContainer: {
    justifyContent: 'flex-end',
    paddingBottom: height * 0.01,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProfilePage;
